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

import { openEnvelope, type Envelope } from "./vault";
import { currentIdentity } from "./session";

export type SealedMessage = {
  body?: string | null;
  sealed_body?: Envelope | null;
  encrypted?: boolean;
};

export type MessageBody =
  | { kind: "readable"; text: string }
  | { kind: "locked"; text: string }
  | { kind: "foreign"; text: string }
  | { kind: "corrupt"; text: string };

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
    // Not sealed: either plaintext by design (a server_readable conversation,
    // or the old Node engine) or genuinely empty. An empty plaintext body is a
    // real state and is reported as readable-but-empty, not as an error.
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
