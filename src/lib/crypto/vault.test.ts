import { describe, it, expect } from "vitest";
import {
  keyId,
  generateKeypair,
  wrapPrivateKey,
  unwrapPrivateKey,
  openEnvelope,
  deriveKek,
  b64encode,
  b64decode,
  type Envelope,
} from "./vault";
import { x25519 } from "@noble/curves/ed25519.js";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

// The engine seals with public keys and holds no private one, so this file is
// the only thing standing between a stored ciphertext and a user who can read
// their own messages. If it drifts from engine-rs/crates/connect-crypto by a
// single byte, nothing opens — and the failure would show up as "all my
// history is gone", not as a stack trace.
//
// The vectors below are asserted in crates/connect-crypto/src/vault.rs, so
// neither side can drift silently.
describe("interoperability with connect-crypto", () => {
  const PINNED_PRIVATE = "AwoRGB8mLTQ7QklQV15lbHN6gYiPlp2kq7K5wMfO1dw=";
  const PINNED_PUBLIC = "u1D/noKldM+/gg6X9g+5wUPsdBXPUU+M/Zjv9Z4FlhQ=";
  const PINNED_KID = "1etLcUFKlyuthcOg75wNIA==";

  it("derives the pinned public key from the pinned private key", () => {
    expect(b64encode(x25519.getPublicKey(b64decode(PINNED_PRIVATE)))).toBe(PINNED_PUBLIC);
  });

  it("derives the pinned key id", () => {
    expect(keyId(b64decode(PINNED_PUBLIC))).toBe(PINNED_KID);
  });

  it("reproduces the pinned Argon2id KEK", async () => {
    // Asserted directly against the vector in CLIENT_CRYPTO.md, which is in
    // turn asserted in crates/connect-crypto/src/vault.rs. A wrap/unwrap
    // round-trip would pass even if this derivation disagreed with the Rust —
    // it proves only that this file agrees with itself.
    const kek = await deriveKek("correct horse battery staple", {
      alg: "argon2id", m: 65536, t: 3, p: 1, salt: "AQIDBAUGBwgJCgsMDQ4PEA==",
    });

    expect(b64encode(kek)).toBe("2OvrUGMswZk3Ee2oXbFVoQfw+xyvq4ijp589RmGsegw=");
  });
});

describe("the key vault", () => {
  const password = "a passphrase the server never sees";

  it("round-trips a private key", async () => {
    const { privateKey } = generateKeypair();
    const vault = await wrapPrivateKey(password, privateKey);

    expect(await unwrapPrivateKey(password, vault)).toEqual(privateKey);
  });

  it("refuses to open with the wrong password", async () => {
    const { privateKey } = generateKeypair();
    const vault = await wrapPrivateKey(password, privateKey);

    await expect(unwrapPrivateKey("not the passphrase", vault)).rejects.toThrow();
  });

  it("carries its own kdf parameters so the cost can be raised later", async () => {
    const { privateKey } = generateKeypair();
    const vault = await wrapPrivateKey(password, privateKey);

    expect(vault.kdf.m).toBeGreaterThan(0);
    expect(vault.kdf.t).toBeGreaterThan(0);
    expect(vault.kdf.p).toBe(1);
    expect(vault.kdf.salt).toBeTruthy();
  });

  it("uses a fresh salt per vault, so the same password gives different blobs", async () => {
    const { privateKey } = generateKeypair();
    const a = await wrapPrivateKey(password, privateKey);
    const b = await wrapPrivateKey(password, privateKey);

    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.ct).not.toBe(b.ct);
  });

  it("wraps the same key under two secrets, either of which opens it", async () => {
    // Enrollment does exactly this: one wrapping under the password, one under
    // the recovery code. Neither secret reveals the other.
    const { privateKey } = generateKeypair();
    const byPassword = await wrapPrivateKey(password, privateKey);
    const byRecovery = await wrapPrivateKey("recovery-code-goes-here", privateKey);

    expect(await unwrapPrivateKey(password, byPassword)).toEqual(privateKey);
    expect(await unwrapPrivateKey("recovery-code-goes-here", byRecovery)).toEqual(privateKey);
    await expect(unwrapPrivateKey(password, byRecovery)).rejects.toThrow();
  });
});

describe("opening a sealed message", () => {
  // Builds an envelope the same way asym.rs does, so these exercise the real
  // reading path rather than a mock of it.
  function sealFor(recipients: Uint8Array[], plaintext: string, ctx = "message-body"): Envelope {
    const enc = new TextEncoder();

    const dek = crypto.getRandomValues(new Uint8Array(32));
    const nonce = crypto.getRandomValues(new Uint8Array(24));
    const ct = xchacha20poly1305(dek, nonce, enc.encode(ctx)).encrypt(enc.encode(plaintext));

    const wrapped = recipients.map((rpk) => {
      const esk = x25519.utils.randomSecretKey();
      const epk = x25519.getPublicKey(esk);
      const shared = x25519.getSharedSecret(esk, rpk);

      const salt = new Uint8Array([...epk, ...rpk]);
      const wrapKey = hkdf(sha256, shared, salt, enc.encode(`securifi-connect/wrap/v1/${ctx}`), 32);

      const kid = keyId(rpk);
      const wn = crypto.getRandomValues(new Uint8Array(24));
      const k = xchacha20poly1305(wrapKey, wn, enc.encode(kid)).encrypt(dek);

      return { kid, epk: b64encode(epk), wn: b64encode(wn), k: b64encode(k) };
    });

    return { v: 1, ctx, n: b64encode(nonce), ct: b64encode(ct), recipients: wrapped };
  }

  it("reads a message sealed to its own key", () => {
    const me = generateKeypair();
    const envelope = sealFor([me.publicKey], "the customer's private message");

    const opened = openEnvelope(me.privateKey, me.publicKey, envelope);

    expect(new TextDecoder().decode(opened!)).toBe("the customer's private message");
  });

  it("returns null rather than throwing when not sealed for this key", () => {
    const me = generateKeypair();
    const someoneElse = generateKeypair();
    const envelope = sealFor([someoneElse.publicKey], "not for you");

    // A normal state — "you do not have access to this conversation" — and the
    // UI must render it as such, not as a crash or a blank line.
    expect(openEnvelope(me.privateKey, me.publicKey, envelope)).toBeNull();
  });

  it("cannot be opened with the wrong private key", () => {
    const me = generateKeypair();
    const attacker = generateKeypair();
    const envelope = sealFor([me.publicKey], "secret");

    // Same public key, so the recipient entry is found — but the ECDH gives a
    // different shared secret, so the AEAD tag must fail.
    expect(() => openEnvelope(attacker.privateKey, me.publicKey, envelope)).toThrow();
  });

  it("refuses a wrap moved into another recipient's slot", () => {
    const alice = generateKeypair();
    const siti = generateKeypair();
    const envelope = sealFor([alice.publicKey, siti.publicKey], "secret");

    // Take Siti's wrap and relabel it with Alice's kid. The HKDF salt commits
    // to both public keys and the AAD commits to the kid, so this must not
    // open. asym.rs has the same test.
    const aliceKid = keyId(alice.publicKey);
    const sitiWrap = envelope.recipients.find((r) => r.kid !== aliceKid)!;
    const forged: Envelope = { ...envelope, recipients: [{ ...sitiWrap, kid: aliceKid }] };

    expect(() => openEnvelope(alice.privateKey, alice.publicKey, forged)).toThrow();
  });

  it("seals to several readers at once", () => {
    const a = generateKeypair();
    const b = generateKeypair();
    const envelope = sealFor([a.publicKey, b.publicKey], "shared with both");

    expect(new TextDecoder().decode(openEnvelope(a.privateKey, a.publicKey, envelope)!)).toBe("shared with both");
    expect(new TextDecoder().decode(openEnvelope(b.privateKey, b.publicKey, envelope)!)).toBe("shared with both");
  });
});
