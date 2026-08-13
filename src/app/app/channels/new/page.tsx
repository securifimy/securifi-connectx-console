"use client";

// Linking a WhatsApp account starts by asking which number to link.
//
// It used to provision a channel the moment someone arrived on this URL, which
// had two consequences: the page created accounts nobody asked for (twice per
// visit, and again on every refresh), and it could only offer a QR, because a
// pairing code needs a number and nobody had been asked for one.
//
// Asking first fixes both. Nothing is created until the button is pressed, and
// the sturdier of the two linking methods becomes the default: a QR sequence
// expires in about two minutes, while a typed code lasts far longer and
// survives a page reload.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { apiCreateChannelAccount } from "@/lib/api";
import { useChannelWizard } from "@/lib/channel-wizard-store";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import Link from "next/link";

/** Digits only, the way WhatsApp wants it — people paste all sorts of things. */
function digitsOf(input: string): string {
  return input.replace(/\D+/g, "");
}

export default function ChannelCreatePage() {
  const router = useRouter();
  const { token } = useAuthStore();
  const { reset, setChannelAccountId, setStatus, setQr, setPairingCode } = useChannelWizard();

  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digits = digitsOf(phone);
  const usable = digits.length >= 8 && digits.length <= 15;

  async function link(withCode: boolean) {
    if (!token) {
      router.replace("/login");
      return;
    }
    setBusy(true);
    setError(null);
    reset();

    try {
      // The number travels with the create: the workspace starts the linking
      // session as soon as the account exists, and a start sent afterwards
      // arrives at a session already running, so the code would never be
      // requested.
      const created = await apiCreateChannelAccount(token, {
        kind: "whatsapp_unofficial",
        display_name: "New WhatsApp Channel",
        ...(withCode ? { phone_number: digits } : {}),
      });
      if (!created?.id) throw new Error("The workspace did not return a channel to link.");

      setChannelAccountId(created.id);
      setStatus(created.status || "pending");
      setQr(null);
      setPairingCode(null);

      router.replace("/app/channels/new/qr");
    } catch (err) {
      console.error("Failed to start linking", err);
      setError(err instanceof Error ? err.message : "Could not start linking. Please try again.");
      setBusy(false);
    }
  }

  return (
    <WorkspaceShell
      activeNav="channels"
      header={{
        title: "Link WhatsApp",
        subtitle: "Connect a WhatsApp account to this workspace.",
      }}
    >
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <Link href="/app/channels" className="hover:text-foreground">
            Channels
          </Link>
          <span>/</span>
          <span className="text-foreground">Link WhatsApp</span>
        </div>

        <section className="space-y-5 rounded-2xl border border-border/60 bg-[hsl(var(--card))] p-8 shadow-sm">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Which number are you linking?</h2>
            <p className="text-sm text-muted-foreground">
              We will show you an 8-character code to type into that phone. Include the country
              code — for Malaysia that is 60.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="pairing-phone" className="text-sm font-medium text-foreground">
              WhatsApp number
            </label>
            <input
              id="pairing-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="60123456789"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={phone}
              disabled={busy}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && usable && !busy) void link(true);
              }}
            />
            {phone.length > 0 && !usable && (
              <p className="text-xs text-muted-foreground">
                That does not look like a full number yet — country code and all, digits only.
              </p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              disabled={busy || !usable}
              onClick={() => void link(true)}
            >
              {busy ? "Starting…" : "Get my pairing code"}
            </button>

            {/* Kept reachable, not promoted: scanning still works for anyone
                who prefers it, and for a phone whose number is awkward to
                type. */}
            <button
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50"
              disabled={busy}
              onClick={() => void link(false)}
            >
              Scan a QR code instead
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            On the phone: WhatsApp → Settings → Linked Devices → Link a device → Link with phone
            number.
          </p>
        </section>
      </div>
    </WorkspaceShell>
  );
}
