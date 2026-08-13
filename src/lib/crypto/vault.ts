// The reading half of the end-to-end encryption scheme.
//
// The engine seals messages with public keys and never holds a private one, so
// if this file is wrong nothing opens. It must stay byte-compatible with
// engine-rs/crates/connect-crypto — the contract and reference vectors are in
// engine-rs/docs/CLIENT_CRYPTO.md, and vault.test.ts asserts them.
//
// The one invariant: the password never leaves this file's callers. It is not
// sent to the server in any form, and the unwrapped private key is held in
// memory only — never localStorage, never sessionStorage, both of which any XSS
// on the page can read.

import { argon2id } from "hash-wasm";
import { x25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";

const KID_PREFIX = "securifi-connect/kid/v1";
const VAULT_AAD = "securifi-connect/vault/v1";
const WRAP_INFO_PREFIX = "securifi-connect/wrap/v1/";

// Defaults for a NEW vault. Never used when opening one — an existing vault's
// parameters are read from the vault itself, which is what allows the cost to
// be raised later without locking anyone out of a blob written under the old
// cost. p=1 deliberately: browsers are effectively single-threaded here, and a
// value they cannot reproduce is worse than a cheaper one they can.
export const VAULT_KDF_DEFAULTS = { alg: "argon2id", m: 65536, t: 3, p: 1 } as const;

export type VaultKdf = { alg?: string; m: number; t: number; p: number; salt: string };
export type Vault = { v: number; kdf: VaultKdf; n: string; ct: string };

export type WrappedKey = { kid: string; epk: string; wn: string; k: string };
export type Envelope = { v: number; ctx: string; n: string; ct: string; recipients: WrappedKey[] };

export const b64encode = (bytes: Uint8Array): string => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};

export const b64decode = (text: string): Uint8Array => {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
};

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

const randomBytes = (n: number): Uint8Array => crypto.getRandomValues(new Uint8Array(n));

/** First 16 bytes of SHA256("securifi-connect/kid/v1" || publicKey), base64. */
export function keyId(publicKey: Uint8Array): string {
  return b64encode(sha256(concat(utf8(KID_PREFIX), publicKey)).slice(0, 16));
}

export function generateKeypair(): { privateKey: Uint8Array; publicKey: Uint8Array } {
  const privateKey = x25519.utils.randomSecretKey();
  return { privateKey, publicKey: x25519.getPublicKey(privateKey) };
}

/**
 * Argon2id. Parameters always come from the caller, never from constants.
 *
 * Exported so the reference vector in CLIENT_CRYPTO.md can be asserted
 * directly. A round-trip test would pass even if this derivation disagreed
 * with connect-crypto — it only proves this file agrees with itself, and the
 * whole point is agreeing with the Rust.
 */
export async function deriveKek(password: string, kdf: VaultKdf): Promise<Uint8Array> {
  return argon2id({
    password,
    salt: b64decode(kdf.salt),
    parallelism: kdf.p,
    iterations: kdf.t,
    memorySize: kdf.m,
    hashLength: 32,
    outputType: "binary",
  });
}

/**
 * Wraps a private key under a secret. Used twice at enrollment with the same
 * private key: once under the password, once under the recovery code. Either
 * secret opens it; neither reveals the other.
 */
export async function wrapPrivateKey(secret: string, privateKey: Uint8Array): Promise<Vault> {
  const kdf: VaultKdf = { ...VAULT_KDF_DEFAULTS, salt: b64encode(randomBytes(16)) };
  const kek = await deriveKek(secret, kdf);
  const nonce = randomBytes(24);
  const ct = xchacha20poly1305(kek, nonce, utf8(VAULT_AAD)).encrypt(privateKey);

  return { v: 1, kdf, n: b64encode(nonce), ct: b64encode(ct) };
}

/** Throws if the secret is wrong — the AEAD tag will not verify. */
export async function unwrapPrivateKey(secret: string, vault: Vault): Promise<Uint8Array> {
  const kek = await deriveKek(secret, vault.kdf);
  return xchacha20poly1305(kek, b64decode(vault.n), utf8(VAULT_AAD)).decrypt(b64decode(vault.ct));
}

/**
 * Opens a sealed message. Returns null when the envelope holds no wrap for this
 * key — that is a normal state meaning "not sealed for you", not an error, and
 * callers must show it as such rather than as a crash or a blank message.
 */
export function openEnvelope(
  privateKey: Uint8Array,
  publicKey: Uint8Array,
  envelope: Envelope,
): Uint8Array | null {
  const kid = keyId(publicKey);
  const entry = envelope.recipients?.find((r) => r.kid === kid);
  if (!entry) return null;

  const epk = b64decode(entry.epk);
  const shared = x25519.getSharedSecret(privateKey, epk);

  // The salt commits to BOTH public keys and the AAD commits to the kid. That
  // pair is what stops a wrap being lifted into another recipient's slot;
  // asym.rs has a test that attempts exactly that and requires it to fail.
  // Do not "simplify" either away.
  const wrapKey = hkdf(sha256, shared, concat(epk, publicKey), utf8(WRAP_INFO_PREFIX + envelope.ctx), 32);

  const dek = xchacha20poly1305(wrapKey, b64decode(entry.wn), utf8(kid)).decrypt(b64decode(entry.k));

  return xchacha20poly1305(dek, b64decode(envelope.n), utf8(envelope.ctx)).decrypt(b64decode(envelope.ct));
}
