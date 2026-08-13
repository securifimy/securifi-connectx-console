"use client";

// Setting up an encryption key is not optional, so it happens before the
// workspace opens rather than at the moment something needs it.
//
// The reason is not tidiness. Conversations are private by default, which means
// a workspace where nobody holds a key cannot receive: the engine refuses to
// seal to nobody and DROPS the message rather than storing it in the clear. A
// user who reaches the inbox before enrolling is a user whose messages are
// being lost while the screen looks normal. Replies fail for the same reason,
// one layer later.
//
// So this blocks. Everything below it in the tree renders only once a key
// exists for this account.

import { useCallback, useEffect, useState } from "react";
import { apiGetReaderKey } from "@/lib/api";
import { ReaderKeyGate } from "./ReaderKeyGate";

type Phase = "checking" | "needsKey" | "allowed";

export function RequireReaderKey({ token, children }: { token: string; children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("checking");

  useEffect(() => {
    let cancelled = false;

    apiGetReaderKey(token)
      .then((s) => {
        if (!cancelled) setPhase(s.enrolled ? "allowed" : "needsKey");
      })
      .catch(() => {
        // Fail soft, deliberately. If the check itself cannot be made, locking
        // the whole console out of an unrelated API blip would be its own
        // outage — and the layers that actually need the key each refuse on
        // their own: sealed messages render as locked, and a reply to a private
        // conversation is refused with the reason on screen.
        if (!cancelled) setPhase("allowed");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const onEnrolled = useCallback(() => setPhase("allowed"), []);

  if (phase === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Checking your encryption key…
      </div>
    );
  }

  if (phase === "needsKey") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-[hsl(var(--background))]">
        <div className="w-full max-w-md space-y-4">
          <div className="space-y-2">
            <h1 className="text-lg font-medium">Set up encryption before you start</h1>
            <p className="text-sm text-muted-foreground">
              Conversations here are private by default: messages are locked to your key before they
              reach our servers, so we cannot read them — and until you have a key, we cannot receive
              or send them for you either.
            </p>
            <p className="text-sm text-muted-foreground">
              This takes one step and cannot be done for you, because your passphrase never leaves
              this browser.
            </p>
          </div>

          <ReaderKeyGate token={token} onUnlocked={onEnrolled} />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
