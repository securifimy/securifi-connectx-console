// The unwrapped private key for this browser session.
//
// Held in memory only. Not localStorage, not sessionStorage — both are readable
// by any XSS on the page. In memory is not much better against a determined
// XSS, but it does not survive a tab reload, which limits the window
// considerably. See engine-rs/docs/CLIENT_CRYPTO.md.
//
// Nothing here ever sends the passphrase anywhere. Unwrapping happens locally;
// the server only ever supplied the inert vault blob.

import {
  generateKeypair,
  wrapPrivateKey,
  unwrapPrivateKey,
  keyId,
  b64decode,
  b64encode,
  type Vault,
} from "./vault";

export type ReaderIdentity = {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  kid: string;
};

let current: ReaderIdentity | null = null;

export function currentIdentity(): ReaderIdentity | null {
  return current;
}

export function isUnlocked(): boolean {
  return current !== null;
}

/** Called on sign-out and whenever the session ends. */
export function lock(): void {
  if (current) {
    // Overwrite before dropping the reference. Does not defeat a determined
    // attacker with heap access, but leaves no idle copy lying around.
    current.privateKey.fill(0);
  }
  current = null;
}

/**
 * Unwraps the vault with the user's passphrase and holds the key for the
 * session. Throws if the passphrase is wrong — the AEAD tag will not verify.
 */
export async function unlock(passphrase: string, vault: Vault, publicKeyB64: string): Promise<ReaderIdentity> {
  const privateKey = await unwrapPrivateKey(passphrase, vault);
  const publicKey = b64decode(publicKeyB64);

  current = { privateKey, publicKey, kid: keyId(publicKey) };
  return current;
}

/**
 * Generates a keypair and wraps it twice: once under the passphrase, once under
 * a recovery code. Returns what the server should store plus the recovery code,
 * which must be shown to the user exactly once.
 *
 * The recovery code is not optional. Without it a forgotten passphrase destroys
 * all history, because the server cannot re-wrap a key it has never seen.
 */
export async function enroll(passphrase: string): Promise<{
  kid: string;
  public_key: string;
  vault: Vault;
  recovery_vault: Vault;
  recoveryCode: string;
}> {
  const { privateKey, publicKey } = generateKeypair();
  const recoveryCode = generateRecoveryCode();

  const [vault, recovery_vault] = await Promise.all([
    wrapPrivateKey(passphrase, privateKey),
    wrapPrivateKey(recoveryCode, privateKey),
  ]);

  current = { privateKey, publicKey, kid: keyId(publicKey) };

  return { kid: keyId(publicKey), public_key: b64encode(publicKey), vault, recovery_vault, recoveryCode };
}

/** Re-wraps the held key under a new passphrase. The keypair is untouched, so
 * nothing already sealed needs re-sealing. */
export async function rewrap(newPassphrase: string): Promise<Vault> {
  if (!current) throw new Error("locked: cannot re-wrap a key that is not held");

  return wrapPrivateKey(newPassphrase, current.privateKey);
}

/** Human-transcribable: no ambiguous characters, grouped for reading aloud. */
function generateRecoveryCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);

  return (chars.join("").match(/.{1,5}/g) ?? []).join("-");
}
