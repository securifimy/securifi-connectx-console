"use client";

// Where a person enrolls a key or unlocks the one they have.
//
// Everything below happens in the browser. The passphrase is never sent, and
// the unwrapped private key is held in memory for the session only — see
// lib/crypto/session.ts. The server only ever supplies the inert vault blob.

import { useCallback, useEffect, useState } from "react";
import { apiGetReaderKey, apiEnrollReaderKey, type ReaderKeyStatus } from "@/lib/api";
import { enroll, unlock, isUnlocked } from "@/lib/crypto/session";
import type { Vault } from "@/lib/crypto/vault";

type Phase = "loading" | "enroll" | "locked" | "showRecovery" | "ready" | "error";

export function ReaderKeyGate({ token, onUnlocked }: { token: string; onUnlocked?: () => void }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [status, setStatus] = useState<ReaderKeyStatus | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiGetReaderKey(token)
      .then((s) => {
        if (cancelled) return;
        setStatus(s);
        // Already unlocked in this session — a remount must not ask again.
        setPhase(isUnlocked() ? "ready" : s.enrolled ? "locked" : "enroll");
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleEnroll = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const enrolled = await enroll(passphrase);
      await apiEnrollReaderKey(token, {
        kid: enrolled.kid,
        public_key: enrolled.public_key,
        vault: enrolled.vault as Vault,
        recovery_vault: enrolled.recovery_vault as Vault,
      });
      setRecoveryCode(enrolled.recoveryCode);
      setPhase("showRecovery");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPassphrase("");
      setBusy(false);
    }
  }, [passphrase, token]);

  const handleUnlock = useCallback(async () => {
    if (!status || !status.enrolled) return;
    setBusy(true);
    setError(null);
    try {
      await unlock(passphrase, status.vault as Vault, status.public_key);
      setPhase("ready");
      onUnlocked?.();
    } catch {
      // Deliberately vague: the only way to be sure is to try, and the AEAD
      // tag failing is indistinguishable from a corrupt blob.
      setError("That passphrase did not open your key.");
    } finally {
      setPassphrase("");
      setBusy(false);
    }
  }, [passphrase, status, onUnlocked]);

  if (phase === "loading") return <p className="text-sm text-muted-foreground">Checking your key…</p>;

  if (phase === "error") {
    return <p className="text-sm text-destructive">Could not load your key material: {error}</p>;
  }

  if (phase === "ready") return null;

  if (phase === "showRecovery") {
    return (
      <div className="space-y-3 rounded-xl border border-border/60 p-4">
        <h2 className="font-medium">Save your recovery code</h2>
        <p className="text-sm text-muted-foreground">
          This is shown once. If you forget your passphrase this code is the only way back to your
          messages — we cannot reset it, because we never had your key.
        </p>
        <code className="block rounded-lg bg-muted px-3 py-2 font-mono text-sm">{recoveryCode}</code>
        <button
          className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
          onClick={() => {
            setRecoveryCode(null);
            setPhase("ready");
            onUnlocked?.();
          }}
        >
          I have saved it
        </button>
      </div>
    );
  }

  const enrolling = phase === "enroll";

  return (
    <div className="space-y-3 rounded-xl border border-border/60 p-4">
      <h2 className="font-medium">{enrolling ? "Set up encrypted messages" : "Unlock your messages"}</h2>
      <p className="text-sm text-muted-foreground">
        {enrolling
          ? "Choose a passphrase. It never leaves this browser, so nobody here can read your conversations — and nobody here can reset it for you."
          : "Your passphrase unlocks your key in this browser. It is not sent anywhere."}
      </p>

      <input
        type="password"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        placeholder="Passphrase"
        value={passphrase}
        autoComplete={enrolling ? "new-password" : "current-password"}
        onChange={(e) => setPassphrase(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && passphrase.length >= 8 && !busy) {
            void (enrolling ? handleEnroll() : handleUnlock());
          }
        }}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
        disabled={busy || passphrase.length < 8}
        onClick={() => void (enrolling ? handleEnroll() : handleUnlock())}
      >
        {busy ? "Working…" : enrolling ? "Create my key" : "Unlock"}
      </button>

      {enrolling && (
        <p className="text-xs text-muted-foreground">
          Minimum 8 characters. Deriving the key takes about a second — that slowness is deliberate.
        </p>
      )}
    </div>
  );
}
