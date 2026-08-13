import { describe, it, expect } from "vitest";
import {
  keyId,
  generateKeypair,
  wrapPrivateKey,
  unwrapPrivateKey,
  openEnvelope,
  sealFor as realSealFor,
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
  // The real sealing path, not a copy of it. A local re-implementation would
  // keep passing after vault.ts drifted away from it, which is the one thing
  // these tests exist to catch.
  function sealFor(recipients: Uint8Array[], plaintext: string, ctx = "message-body"): Envelope {
    return realSealFor(recipients, new TextEncoder().encode(plaintext), ctx);
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

// The property that actually matters: an envelope produced by the Rust engine
// opens in the browser. Everything above proves the two sides agree on the
// primitives and that this file agrees with itself — neither of which would
// stop a whole-envelope mismatch from making every stored message unreadable.
//
// This fixture is byte-identical to the one in
// engine-rs/crates/connect-crypto/tests/fixtures/envelope_v1.json, which the
// Rust side opens in its own test. Neither implementation can drift without one
// of the two failing. Regenerate with:
//   cargo test -p connect-crypto --test interop emit_fixture -- --ignored --nocapture
describe("opening an envelope sealed by engine-rs", () => {
  const FIXTURE_PRIVATE = "AwoRGB8mLTQ7QklQV15lbHN6gYiPlp2kq7K5wMfO1dw=";
  const FIXTURE_PUBLIC = "u1D/noKldM+/gg6X9g+5wUPsdBXPUU+M/Zjv9Z4FlhQ=";
  const FIXTURE_PLAINTEXT = "the customer's private message";

  // Sealed by seal_for() in Rust, not by any JavaScript.
  const fixture: Envelope = {
    v: 1,
    ctx: "message-body",
    n: "HSkwSw2rv3uAwEQFqQ127LJ2WmB+r7fu",
    ct: "lIaP32QY+1yc/r/IZ9+XzlddbEmmoIWtWXnpgn1zZMpZVEeQtCQyrxv3PaUVkQ==",
    recipients: [
      {
        kid: "1etLcUFKlyuthcOg75wNIA==",
        epk: "19FdBnTnlnrJhRf86iwiGAlJLpcme5wqbrbHNg4hcH8=",
        wn: "4vMJItCtbYpr970RI9sELMSD35ZEAzSj",
        k: "hO243ujZs6ptcqSl6zEWM6slo13Jk6dAtyquXMSjfz3IXLX0UTof/GxMTy4ivLRh",
      },
    ],
  };

  it("reads the plaintext the Rust engine sealed", () => {
    const opened = openEnvelope(b64decode(FIXTURE_PRIVATE), b64decode(FIXTURE_PUBLIC), fixture);

    expect(opened).not.toBeNull();
    expect(new TextDecoder().decode(opened!)).toBe(FIXTURE_PLAINTEXT);
  });

  it("refuses the same envelope with an unrelated key", () => {
    const stranger = generateKeypair();

    // The kid will not match, so this is the "not sealed for you" path.
    expect(openEnvelope(stranger.privateKey, stranger.publicKey, fixture)).toBeNull();
  });

  it("refuses the fixture when the private key does not match its public key", () => {
    const stranger = generateKeypair();

    // kid matches so the entry is found, but the ECDH differs — the tag must fail.
    expect(() => openEnvelope(stranger.privateKey, b64decode(FIXTURE_PUBLIC), fixture)).toThrow();
  });
});

// Outbound runs the other way: the browser seals, the engine opens. Nothing
// above proves that direction, and a mistake in it would not look like an
// error — the reply would simply never be sent, or worse, be sendable by
// somebody it was not sealed to.
describe("sealing a reply the engine has to open", () => {
  // The key the fixture below is sealed to, matching the constant in
  // engine-rs/crates/connect-crypto/tests/interop.rs. A test vector; it protects
  // nothing real.
  const ENGINE_PRIVATE = "AwoRGB8mLTQ7QklQV15lbHN6gYiPlp2kq7K5wMfO1dw=";
  const ENGINE_PUBLIC = "u1D/noKldM+/gg6X9g+5wUPsdBXPUU+M/Zjv9Z4FlhQ=";

  it("seals a reply the engine's key opens", () => {
    const envelope = realSealFor([b64decode(ENGINE_PUBLIC)], new TextEncoder().encode("boleh, saya hantar"), "message-transmit");

    const opened = openEnvelope(b64decode(ENGINE_PRIVATE), b64decode(ENGINE_PUBLIC), envelope);
    expect(new TextDecoder().decode(opened!)).toBe("boleh, saya hantar");
  });

  it("does not let anyone else open the transmit copy", () => {
    const stranger = generateKeypair();
    const envelope = realSealFor([b64decode(ENGINE_PUBLIC)], new TextEncoder().encode("secret"), "message-transmit");

    expect(openEnvelope(stranger.privateKey, stranger.publicKey, envelope)).toBeNull();
  });

  it("refuses to seal to nobody", () => {
    // An envelope with no recipients is unreadable forever. Losing the reply is
    // recoverable; storing something nobody can ever open is not.
    expect(() => realSealFor([], new TextEncoder().encode("x"), "message-transmit")).toThrow();
  });

  it("seals the history copy to every reader", () => {
    const ali = generateKeypair();
    const siti = generateKeypair();
    const envelope = realSealFor([ali.publicKey, siti.publicKey], new TextEncoder().encode("reply"), "message-body");

    for (const reader of [ali, siti]) {
      expect(new TextDecoder().decode(openEnvelope(reader.privateKey, reader.publicKey, envelope)!)).toBe("reply");
    }
  });

  // Writes the fixture the Rust side opens in its own test, proving a
  // browser-sealed envelope survives the crossing. A generator, not a check —
  // run it only when the wire format changes:
  //   EMIT_TS_FIXTURE=1 npx vitest run src/lib/crypto/vault.test.ts
  it("emits the cross-language fixture", async () => {
    if (!process.env.EMIT_TS_FIXTURE) return;

    const envelope = realSealFor([b64decode(ENGINE_PUBLIC)], new TextEncoder().encode("the agent's reply"), "message-transmit");
    const fs = await import("node:fs/promises");

    await fs.writeFile(
      "../engine-rs/crates/connect-crypto/tests/fixtures/transmit_v1.json",
      JSON.stringify(envelope, null, 2) + "\n",
    );
  });
});
