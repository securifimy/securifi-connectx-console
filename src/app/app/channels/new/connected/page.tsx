"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
      reset();
      router.replace("/app/channels");
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
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
      <div>
        <h1 className="text-2xl font-semibold text-white">WhatsApp Connected!</h1>
        <p className="text-sm text-slate-400 mt-1">
          Your phone is now linked to Securifi Connect.
        </p>
      </div>

      {loading && <p className="text-sm text-slate-400">Fetching channel details…</p>}

      {error && (
        <p className="text-xs text-red-400 max-w-sm">
          {error}
        </p>
      )}

      {account && (
        <form
          onSubmit={handleFinish}
          className="w-full max-w-md text-left bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4 text-sm text-slate-200"
        >
          <div className="space-y-1">
            <p className="text-xs text-slate-500">Channel ID</p>
            <p className="font-semibold text-white">{account.id}</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-slate-400">
              Channel name
            </label>
            <input
              className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="WhatsApp Channel Name"
              required
            />
            {detectedPushName && (
              <p className="text-[11px] text-slate-500">
                Suggested from WhatsApp: {detectedPushName}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              WhatsApp number (from engine)
            </p>
            <p className="font-mono text-white">
              {detectedPhone || "Detecting..."}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Current status
            </p>
            <p>{account.status || "unknown"}</p>
          </div>

          {saveError && (
            <p className="text-xs text-amber-400">
              {saveError}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex w-full items-center justify-center rounded-md bg-green-600 hover:bg-green-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save & Finish"}
          </button>
        </form>
      )}

      {!account && !loading && (
        <button
          onClick={() => router.replace("/app/channels")}
          className="inline-flex items-center rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white"
        >
          Back to channels
        </button>
      )}
    </div>
  );
}
