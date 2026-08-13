import { describe, it, expect, beforeEach } from "vitest";
import { resolveMessageBody, isSealed } from "./message";
import { generateKeypair, keyId, b64encode, b64decode, type Envelope } from "./vault";
import { enroll, unlock, lock, isUnlocked, rewrap, currentIdentity } from "./session";
import { x25519 } from "@noble/curves/ed25519.js";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

function sealFor(recipients: Uint8Array[], plaintext: string, ctx = "message-body"): Envelope {
  const enc = new TextEncoder();
  const dek = crypto.getRandomValues(new Uint8Array(32));
  const nonce = crypto.getRandomValues(new Uint8Array(24));
  const ct = xchacha20poly1305(dek, nonce, enc.encode(ctx)).encrypt(enc.encode(plaintext));

  const wrapped = recipients.map((rpk) => {
    const esk = x25519.utils.randomSecretKey();
    const epk = x25519.getPublicKey(esk);
    const shared = x25519.getSharedSecret(esk, rpk);
    const wrapKey = hkdf(sha256, shared, new Uint8Array([...epk, ...rpk]), enc.encode(`securifi-connect/wrap/v1/${ctx}`), 32);
    const kid = keyId(rpk);
    const wn = crypto.getRandomValues(new Uint8Array(24));
    return { kid, epk: b64encode(epk), wn: b64encode(wn), k: b64encode(xchacha20poly1305(wrapKey, wn, enc.encode(kid)).encrypt(dek)) };
  });

  return { v: 1, ctx, n: b64encode(nonce), ct: b64encode(ct), recipients: wrapped };
}

const identityFor = (kp: { privateKey: Uint8Array; publicKey: Uint8Array }) => ({
  privateKey: kp.privateKey,
  publicKey: kp.publicKey,
  kid: keyId(kp.publicKey),
});

describe("resolving a message for display", () => {
  // The rule that matters more than any other here: never return an empty
  // string for a message that exists. A blank line is indistinguishable from a
  // message that was never sent.
  it("never renders a sealed message as blank, in any state", () => {
    const me = generateKeypair();
    const stranger = generateKeypair();

    const cases = [
      { msg: { sealed_body: sealFor([me.publicKey], "hello") }, identity: null },
      { msg: { sealed_body: sealFor([stranger.publicKey], "hello") }, identity: identityFor(me) },
      { msg: { sealed_body: { ...sealFor([me.publicKey], "hello"), ct: "AAAA" } }, identity: identityFor(me) },
    ];

    for (const { msg, identity } of cases) {
      const resolved = resolveMessageBody(msg as never, identity);
      expect(resolved.text.length).toBeGreaterThan(0);
      expect(resolved.kind).not.toBe("readable");
    }
  });

  it("reads a message sealed to this reader", () => {
    const me = generateKeypair();
    const msg = { sealed_body: sealFor([me.publicKey], "the customer said hello") };

    expect(resolveMessageBody(msg as never, identityFor(me))).toEqual({
      kind: "readable",
      text: "the customer said hello",
    });
  });

  it("reports locked rather than empty when the browser has no key yet", () => {
    const me = generateKeypair();
    const msg = { sealed_body: sealFor([me.publicKey], "secret") };

    expect(resolveMessageBody(msg as never, null).kind).toBe("locked");
  });

  it("distinguishes 'not for you' from 'broken'", () => {
    const me = generateKeypair();
    const stranger = generateKeypair();

    const notMine = { sealed_body: sealFor([stranger.publicKey], "theirs") };
    expect(resolveMessageBody(notMine as never, identityFor(me)).kind).toBe("foreign");

    const tampered = { sealed_body: { ...sealFor([me.publicKey], "mine"), ct: "AAAAAAAAAAAAAAAAAAAA" } };
    expect(resolveMessageBody(tampered as never, identityFor(me)).kind).toBe("corrupt");
  });

  it("passes plaintext through untouched", () => {
    expect(resolveMessageBody({ body: "in the clear" })).toEqual({
      kind: "readable",
      text: "in the clear",
    });
  });

  it("treats a genuinely empty plaintext body as readable, not as an error", () => {
    // An empty message is a real thing; it must not be reported as encrypted
    // or broken just because there is nothing to show.
    expect(resolveMessageBody({ body: "" }).kind).toBe("readable");
  });

  it("knows which messages are sealed", () => {
    const me = generateKeypair();
    expect(isSealed({ body: "clear" })).toBe(false);
    expect(isSealed({ sealed_body: sealFor([me.publicKey], "x") })).toBe(true);
  });
});

describe("the reader session", () => {
  beforeEach(() => lock());

  it("holds no key until unlocked", () => {
    expect(isUnlocked()).toBe(false);
    expect(currentIdentity()).toBeNull();
  });

  it("enrolls, then reads its own sealed message", async () => {
    const enrolled = await enroll("a passphrase the server never sees");
    const msg = { sealed_body: sealFor([b64decode(enrolled.public_key)], "after enrollment") };

    expect(resolveMessageBody(msg as never).kind).toBe("readable");
    expect(resolveMessageBody(msg as never).text).toBe("after enrollment");
  });

  it("issues a recovery code that opens the same key", async () => {
    const enrolled = await enroll("original passphrase");
    lock();

    await unlock(enrolled.recoveryCode, enrolled.recovery_vault, enrolled.public_key);

    expect(isUnlocked()).toBe(true);
    expect(currentIdentity()!.kid).toBe(enrolled.kid);
  });

  it("refuses to unlock with the wrong passphrase and stays locked", async () => {
    const enrolled = await enroll("original passphrase");
    lock();

    await expect(unlock("wrong", enrolled.vault, enrolled.public_key)).rejects.toThrow();
    expect(isUnlocked()).toBe(false);
  });

  it("keeps the same keypair across a passphrase change", async () => {
    const enrolled = await enroll("old passphrase");
    const before = currentIdentity()!.kid;

    const newVault = await rewrap("new passphrase");
    lock();
    await unlock("new passphrase", newVault, enrolled.public_key);

    expect(currentIdentity()!.kid).toBe(before);
    // The point: messages sealed before the change still open afterwards.
    const msg = { sealed_body: sealFor([b64decode(enrolled.public_key)], "sealed before the change") };
    expect(resolveMessageBody(msg as never).text).toBe("sealed before the change");
  });

  it("forgets the key on lock", async () => {
    await enroll("passphrase");
    lock();

    expect(isUnlocked()).toBe(false);
    const me = generateKeypair();
    expect(resolveMessageBody({ sealed_body: sealFor([me.publicKey], "x") } as never).kind).toBe("locked");
  });
});
