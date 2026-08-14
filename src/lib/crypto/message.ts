// Turning a stored message into something to put on screen.
//
// A sealed message has no plaintext body, so the render path has to answer four
// different questions, and the difference between them matters to the person
// reading:
//
//   readable   - here is the text
//   locked     - sealed, and this browser has not been unlocked yet
//   foreign    - sealed, but not for this reader's key
//   corrupt    - sealed for this key, and it would not open
//
// The one thing this must never do is return an empty string and let the UI
// render a blank line. A message that silently disappears is indistinguishable
// from one that was never sent, and that is the failure this whole scheme is
// supposed to make impossible.

import { openEnvelope, sealFor, b64decode, type Envelope } from "./vault";
import { currentIdentity } from "./session";

export type SealedMessage = {
  body?: string | null;
  sealed_body?: Envelope | null;
  encrypted?: boolean;
  stored?: boolean;
  pending_history?: boolean;
  error_message?: string | null;
};

export type MessageBody =
  | { kind: "readable"; text: string }
  | { kind: "locked"; text: string }
  | { kind: "foreign"; text: string }
  | { kind: "corrupt"; text: string }
  | { kind: "unstored"; text: string }
  | { kind: "pending"; text: string };

/**
 * `identity` is injectable so this can be tested without a module-level
 * session, and so a caller can render for a specific key.
 */
export function resolveMessageBody(
  message: SealedMessage,
  identity = currentIdentity(),
): MessageBody {
  const envelope = message.sealed_body;

  if (!envelope) {
    // Sealed for transmission with no history copy yet: the window between an
    // API sealed send and the engine returning one, and the permanent state if
    // that seal failed. The words exist, they are just not readable here.
    if (message.pending_history && !message.body) {
      // The error case is not the same as the waiting case, and the server can
      // only tell them apart through error_message — `status` says "sent" for
      // both, because the message genuinely was sent.
      return message.error_message
        ? { kind: "pending", text: `Sent, but we could not store a readable copy: ${message.error_message}` }
        : { kind: "pending", text: "Sealed — history copy pending" };
    }

    // Sent on purpose with no copy kept. Checked only once there is genuinely
    // nothing to show: an unstored message still has its body between the API
    // call and the job clearing it, and saying "no copy kept" while the copy is
    // on screen would be a lie in the safe-looking direction.
    if (message.stored === false && !message.body) {
      return { kind: "unstored", text: "Sent — no copy kept" };
    }

    // Not sealed: either plaintext by design (a server_readable conversation,
    // or the old Node engine) or genuinely empty. An empty plaintext body is a
    // real state and is reported as readable-but-empty, not as an error — the
    // two branches above are what separate it from the states that only look
    // like it.
    return { kind: "readable", text: message.body ?? "" };
  }

  if (!identity) {
    return { kind: "locked", text: "Locked — unlock to read this conversation" };
  }

  try {
    const opened = openEnvelope(identity.privateKey, identity.publicKey, envelope);

    if (opened === null) {
      // No wrap carries this reader's key id. A normal state, per
      // CLIENT_CRYPTO.md, and it is shown rather than hidden.
      return { kind: "foreign", text: "Not shared with you" };
    }

    return { kind: "readable", text: new TextDecoder().decode(opened) };
  } catch {
    // The wrap was for this key id but did not open: a tampered envelope, a
    // rotated key, or a wire-format change. Never silently swallowed — someone
    // has to be able to notice.
    return { kind: "corrupt", text: "Could not be decrypted" };
  }
}

/** True when the text came out of an envelope rather than the clear. */
export function isSealed(message: SealedMessage): boolean {
  return Boolean(message.sealed_body);
}

/**
 * Seals a reply twice before it leaves the browser: once to everyone who may
 * read the conversation, and once to the engine that has to hand the words to
 * WhatsApp. Rails carries both and can open neither.
 *
 * Sealing needs public keys only, so this works while the browser is still
 * locked — you can answer a conversation you cannot yet read back.
 *
 * Both failures below refuse rather than fall back to plaintext. Falling back
 * would send the message, look like success, and quietly break the promise the
 * conversation is marked with, which is worse than not sending.
 */
export function sealReply(
  text: string,
  keys: { readers: string[]; engineKey: string | null },
): { sealed_body: Envelope; transmit_body: Envelope } {
  if (!keys.engineKey) {
    throw new Error(
      "The engine has no key to receive a sealed reply, so nothing was sent.",
    );
  }
  if (keys.readers.length === 0) {
    throw new Error(
      "Nobody here has enrolled an encryption key, so the reply could never be read back. Nothing was sent.",
    );
  }

  const plaintext = new TextEncoder().encode(text);

  return {
    sealed_body: sealFor(keys.readers.map(b64decode), plaintext, HISTORY_CTX),
    transmit_body: sealFor([b64decode(keys.engineKey)], plaintext, TRANSMIT_CTX),
  };
}

// The two envelopes carry different contexts so they cannot stand in for each
// other: the engine refuses a history envelope offered for transmission. Must
// match http.rs and callbacks.rs in engine-rs.
const HISTORY_CTX = "message-body";
const TRANSMIT_CTX = "message-transmit";
