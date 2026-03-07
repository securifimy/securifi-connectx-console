"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { useAuthStore } from "@/lib/auth-store";
import { apiGetChannelAccount, updateChannelAccount } from "@/lib/api";
import { useChannelWizard } from "@/lib/channel-wizard-store";

interface ChannelAccount {
  id: number;
  display_name?: string | null;
  status?: string | null;
  external_identifier?: string | null;
  phone_number?: string | null;
  config?: Record<string, unknown> | null;
}

const extractHostFromConfig = (config?: Record<string, unknown> | null) => {
  if (!config) return null;
  const hostValue = (config as Record<string, unknown>)["host"];
  if (hostValue && typeof hostValue === "object" && hostValue !== null) {
    return hostValue as Record<string, unknown>;
  }
  return null;
};

const extractPhoneFromConfig = (config?: Record<string, unknown> | null) => {
  const host = extractHostFromConfig(config);
  if (host) {
    const fromHost =
      host["phone"] ||
      host["number"] ||
      host["wid"] ||
      (typeof host["wid"] === "object" && host["wid"] !== null
        ? (host["wid"] as Record<string, unknown>)["_serialized"]
        : null);
    if (typeof fromHost === "string" && fromHost.trim() !== "") {
      return fromHost;
    }
  }

  if (!config) return null;
  const value = (config as Record<string, unknown>)["phone"];
  return typeof value === "string" ? value : null;
};

const extractPushName = (config?: Record<string, unknown> | null) => {
  const host = extractHostFromConfig(config);
  if (host && typeof host["pushname"] === "string") {
    return host["pushname"] as string;
  }
  return null;
};

export default function ChannelConnectedPage() {
  const router = useRouter();
  const { token } = useAuthStore();
  const { channelAccountId, reset } = useChannelWizard();
  const [account, setAccount] = useState<ChannelAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!token || !channelAccountId) {
      router.replace("/app/channels");
      return;
    }

    let cancelled = false;

    async function loadAccount() {
      if (!token || !channelAccountId) return;

      setLoading(true);
      setError(null);

      try {
        const data = await apiGetChannelAccount(token, channelAccountId);
        if (!cancelled) {
          setAccount(data);
        }
      } catch (err) {
        console.error("Failed to fetch channel account", err);
        if (!cancelled) {
          setError("Unable to load channel details. You can still finish the wizard.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAccount();

    return () => {
      cancelled = true;
    };
  }, [token, channelAccountId, router]);

  const detectedPhone = useMemo(() => {
    if (account?.phone_number) return account.phone_number;
    if (account?.external_identifier) return account.external_identifier;
    return extractPhoneFromConfig(account?.config);
  }, [account]);

  const detectedPushName = useMemo(() => {
    return extractPushName(account?.config);
  }, [account]);

  useEffect(() => {
    if (!account) return;
    const initial =
      account.display_name ||
      detectedPushName ||
      detectedPhone ||
      "WhatsApp Channel";
    setDisplayName(initial);
  }, [account, detectedPhone, detectedPushName]);

  const handleFinish = async (event?: React.FormEvent) => {
    event?.preventDefault();

    if (!token || !channelAccountId) {
      router.replace("/app/channels");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await updateChannelAccount(token, channelAccountId, {
        status: "active",
        display_name: displayName?.trim() || account?.display_name || "WhatsApp Channel",
      });
      const destination = `/app/channels/${channelAccountId}`;
      reset();
      router.replace(destination);
      return;
    } catch (err) {
      console.error("Failed to finalize channel", err);
      setSaveError("Channel saved but status update failed. You can retry from Channels.");
    } finally {
      setSaving(false);
    }
  };

  if (!channelAccountId) {
    return null;
  }

  return (
    <WorkspaceShell
      activeNav="channels"
      header={{
        title: "Channel Connected",
        subtitle: "Confirm the channel details and finish setup before entering the workspace view.",
      }}
    >
      <div className="space-y-6">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Channels / Finalise setup
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-2xl border border-border/60 bg-[hsl(var(--card))] p-6 shadow-sm">
            {loading && <p className="text-sm text-muted-foreground">Fetching channel details...</p>}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {account && (
              <form onSubmit={handleFinish} className="space-y-5 text-sm">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-border/60 bg-[hsl(var(--background))] p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Channel ID</p>
                    <p className="mt-2 font-semibold text-foreground">{account.id}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-[hsl(var(--background))] p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Detected WhatsApp</p>
                    <p className="mt-2 font-semibold text-foreground">{detectedPhone || "Detecting..."}</p>
                  </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Channel name
                    </label>
                  <input
                    className="w-full rounded-xl border border-border/60 bg-[hsl(var(--background))] px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="WhatsApp Channel Name"
                    required
                  />
                  {detectedPushName && (
                    <p className="text-xs text-muted-foreground">
                      Suggested from WhatsApp: {detectedPushName}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-border/60 bg-[hsl(var(--background))] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Current status</p>
                  <p className="mt-2 font-semibold text-foreground">{account.status || "unknown"}</p>
                </div>

                {saveError && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {saveError}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-[hsl(var(--primary-dark))] disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save and open channel"}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.replace("/app/channels")}
                    className="inline-flex items-center rounded-lg border border-border/60 bg-[hsl(var(--card))] px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted"
                  >
                    Back to channels
                  </button>
                </div>
              </form>
            )}

            {!account && !loading && !error && (
              <button
                onClick={() => router.replace("/app/channels")}
                className="inline-flex items-center rounded-lg border border-border/60 bg-[hsl(var(--card))] px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted"
              >
                Back to channels
              </button>
            )}
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-border/60 bg-[hsl(var(--card))] p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground">What happens next</h2>
              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                <p>We save the display name for this WhatsApp channel.</p>
                <p>The channel remains active and ready to send immediately.</p>
                <p>After saving, you land on the channel detail page instead of returning to the list.</p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </WorkspaceShell>
  );
}
