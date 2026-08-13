"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { apiCreateChannelAccount, apiStartChannelAccountSession } from "@/lib/api";
import { useChannelWizard } from "@/lib/channel-wizard-store";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import Link from "next/link";

export default function ChannelCreatePage() {
  const router = useRouter();
  const { token } = useAuthStore();
  const {
    setChannelAccountId,
    setStatus,
    setQr,
    setLoading,
    setError,
    reset,
    isLoading,
    error,
  } = useChannelWizard();

  // Creating a channel is a write, and this effect runs twice per mount in
  // development — which produced two channel accounts and two live WhatsApp
  // sessions every time someone opened this page, one of them an orphan nobody
  // could see. `cancelled` did not help: it suppresses handling the response,
  // not sending the request.
  //
  // ponytail: guards the double-invoke, not a reload — refreshing this URL still
  // provisions another account, because provisioning is a side effect of
  // arriving here. The real fix is to create on an explicit action, or to reuse
  // the workspace's existing unpaired account; either is a bigger change than
  // the bug in front of us.
  const provisioned = useRef(false);

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }
    if (provisioned.current) return;
    provisioned.current = true;

    const authToken = token as string;

    let cancelled = false;

    async function createChannel() {
      reset();
      setLoading(true);
        setError(null);

        try {
          const result = await apiCreateChannelAccount(authToken, {
            kind: "whatsapp_unofficial",
            display_name: "New WhatsApp Channel",
          });

        if (!cancelled && result?.id) {
          setChannelAccountId(result.id);
          setStatus(result.status || "pending");
          setQr(null);

            await apiStartChannelAccountSession(authToken, result.id);
            if (!cancelled) {
              router.replace("/app/channels/new/qr");
            }
        }
      } catch (err) {
        console.error("Failed to create channel account", err);
        if (!cancelled) {
          setError("Failed to create WhatsApp channel. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    createChannel();

    return () => {
      cancelled = true;
    };
  }, [
    token,
    router,
    reset,
    setChannelAccountId,
    setStatus,
    setQr,
    setLoading,
    setError,
  ]);

  return (
    <WorkspaceShell
      activeNav="channels"
      header={{
        title: "Create Channel",
        subtitle: "Provision a new WhatsApp channel and prepare the secure linking session.",
      }}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Link href="/app/channels" className="hover:text-foreground">
              Channels
            </Link>
            <span>/</span>
            <span className="text-foreground">Create channel</span>
          </div>
        </div>

        <section className="rounded-2xl border border-border/60 bg-[hsl(var(--card))] p-8 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="h-10 w-10 rounded-full border-2 border-border/70 border-t-primary animate-spin" />
            <h2 className="mt-4 text-xl font-semibold text-foreground">Creating your WhatsApp channel...</h2>
            <p className="mt-2 text-sm text-muted-foreground">This usually takes a few seconds.</p>
            {isLoading && (
              <p className="mt-3 text-xs text-muted-foreground">Initialising WhatsApp session...</p>
            )}
            {error && (
              <p className="mt-3 text-xs text-red-600">
                {error}
              </p>
            )}
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}
