import { describe, it, expect, beforeEach } from "vitest";
import { resolveMessageBody, isSealed, sealReply } from "./message";
import {
  generateKeypair,
  keyId,
  b64encode,
  b64decode,
  openEnvelope,
  sealFor as realSealFor,
  type Envelope,
} from "./vault";
import { enroll, unlock, lock, isUnlocked, rewrap, currentIdentity } from "./session";

// The shipped sealing path, not a copy of it: a local re-implementation would
// keep these tests green after vault.ts drifted away from it.
function sealFor(recipients: Uint8Array[], plaintext: string, ctx = "message-body"): Envelope {
  return realSealFor(recipients, new TextEncoder().encode(plaintext), ctx);
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

  it("opens an envelope sealed to it, which is what a server_readable chat now produces", () => {
    const reader = generateKeypair();
    // `sealFor` here is the file-local wrapper at message.test.ts:16, which takes
    // a plaintext STRING and defaults ctx to "message-body" — not the imported
    // one, which arrives as `realSealFor`. Passing a Uint8Array would seal the
    // stringified byte list and the assertion would fail on "112,101,115,...".
    const sealed = sealFor([reader.publicKey], "pesanan");

    // identityFor (message.test.ts:20-24) supplies the `kid` that ReaderIdentity
    // requires (session.ts:21-25). An inline { privateKey, publicKey } runs fine
    // under vitest and fails `tsc --noEmit` one task later, in Task 5.
    const resolved = resolveMessageBody({ body: null, sealed_body: sealed }, identityFor(reader));

    expect(resolved.kind).toBe("readable");
    expect(resolved.text).toBe("pesanan");
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

describe("sealing a reply before it leaves the browser", () => {
  const engine = generateKeypair();
  const ali = generateKeypair();
  const siti = generateKeypair();

  const keys = {
    readers: [ali.publicKey, siti.publicKey].map(b64encode),
    engineKey: b64encode(engine.publicKey),
  };

  it("gives the engine a copy it can open and the readers one they can open", () => {
    const { sealed_body, transmit_body } = sealReply("boleh, saya hantar", keys);

    expect(new TextDecoder().decode(openEnvelope(engine.privateKey, engine.publicKey, transmit_body)!))
      .toBe("boleh, saya hantar");

    for (const reader of [ali, siti]) {
      expect(new TextDecoder().decode(openEnvelope(reader.privateKey, reader.publicKey, sealed_body)!))
        .toBe("boleh, saya hantar");
    }
  });

  // The engine may transmit; it must not become a permanent reader of history.
  it("does not let the engine open the history copy", () => {
    const { sealed_body } = sealReply("private", keys);

    expect(openEnvelope(engine.privateKey, engine.publicKey, sealed_body)).toBeNull();
  });

  it("does not let a reader open the transmit copy", () => {
    const { transmit_body } = sealReply("private", keys);

    expect(openEnvelope(ali.privateKey, ali.publicKey, transmit_body)).toBeNull();
  });

  it("marks the two envelopes so they cannot stand in for each other", () => {
    const { sealed_body, transmit_body } = sealReply("x", keys);

    expect(sealed_body.ctx).toBe("message-body");
    expect(transmit_body.ctx).toBe("message-transmit");
  });

  // Both refusals matter more than they look: falling back to plaintext would
  // send the message, report success, and break the promise the conversation
  // carries — silently.
  it("refuses to send when the engine has no key to receive it", () => {
    expect(() => sealReply("x", { ...keys, engineKey: null })).toThrow(/engine has no key/i);
  });

  it("refuses to send when nobody could ever read it back", () => {
    expect(() => sealReply("x", { ...keys, readers: [] })).toThrow(/nobody/i);
  });
});
