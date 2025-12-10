"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import {
  apiGetChannelAccount,
  apiDisconnectChannelAccount,
  apiDeleteChannelAccount,
  updateChannelAccount,
} from "@/lib/api";

interface ChannelAccount {
  id: number;
  display_name?: string | null;
  external_identifier?: string | null;
  phone_number?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
  config?: Record<string, unknown> | null;
}

export default function ChannelDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { token } = useAuthStore();
  const channelId = Number(params?.id);

  const [channel, setChannel] = useState<ChannelAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!token || Number.isNaN(channelId)) {
      router.replace("/app/channels");
      return;
    }

    const authToken = token as string;
    let cancelled = false;

    async function loadChannel() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGetChannelAccount(authToken, channelId);
        if (cancelled) return;
        setChannel(data);
        setDisplayName(data.display_name || "");
        const metadata = (data.metadata || {}) as Record<string, unknown>;
        setNotes(typeof metadata.notes === "string" ? (metadata.notes as string) : "");
        if (Array.isArray(metadata.tags)) {
          setTags((metadata.tags as string[]).join(", "));
        }
        setPhoneNumber(data.phone_number || "");
      } catch (err) {
        console.error("Failed to load channel account", err);
        if (!cancelled) {
          setError("Failed to load channel");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadChannel();
    return () => {
      cancelled = true;
    };
  }, [token, channelId, router]);

  const detectedPhone = useMemo(() => {
    if (!channel) return null;
    if (channel.phone_number) return channel.phone_number;
    if (channel.external_identifier) return channel.external_identifier;
    const config = channel.config || {};
    const host = config.host as Record<string, unknown> | undefined;
    if (host) {
      if (typeof host.phone === "string") return host.phone;
      if (typeof host.number === "string") return host.number;
      if (typeof host.wid === "string") return host.wid;
      if (host.wid && typeof (host.wid as Record<string, unknown>)._serialized === "string") {
        return (host.wid as Record<string, unknown>)._serialized as string;
      }
    }
    return null;
  }, [channel]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !channel) return;
    const authToken = token as string;

    setSaving(true);
    setError(null);

    try {
      const payload = {
        display_name: displayName,
        phone_number: phoneNumber.trim() || null,
        metadata: {
          notes,
          tags: tags
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0),
        },
      };
      const updated = await updateChannelAccount(authToken, channel.id, payload);
      setChannel(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error("Failed to save channel metadata", err);
      setError("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!token || !channel) return;
    if (!window.confirm("Disconnect this WhatsApp channel?")) return;
    setSaving(true);
    const authToken = token as string;
    try {
      await apiDisconnectChannelAccount(authToken, channel.id);
      const updated = await apiGetChannelAccount(authToken, channel.id);
      setChannel(updated);
    } catch (err) {
      console.error("Failed to disconnect channel", err);
      setError("Failed to disconnect channel");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!token || !channel) return;
    if (!window.confirm("Delete this channel permanently?")) return;
    setSaving(true);
    const authToken = token as string;
    try {
      await apiDeleteChannelAccount(authToken, channel.id);
      router.replace("/app/channels");
    } catch (err) {
      console.error("Failed to delete channel", err);
      setError("Failed to delete channel");
    } finally {
      setSaving(false);
    }
  }

  if (Number.isNaN(channelId)) {
    return (
      <div className="p-6 text-sm text-red-400">
        Invalid channel ID.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 text-sm text-slate-400">
        Loading channel…
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="p-6 text-sm text-red-400">
        {error || "Channel not found."}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            {channel.display_name || "WhatsApp Channel"}
          </h1>
          <p className="text-sm text-slate-400">
            WhatsApp: {detectedPhone || "Unknown"}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Status: {channel.status || "unknown"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/app/channels/${channel.id}/developer`}
            className="px-3 py-1.5 text-sm rounded-md bg-slate-800 text-white hover:bg-slate-700"
          >
            Developer
          </Link>
          {channel.status === "active" && (
            <button
              onClick={handleDisconnect}
              disabled={saving}
              className="px-3 py-1.5 text-sm rounded-md bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-60"
            >
              Disconnect
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={saving}
            className="px-3 py-1.5 text-sm rounded-md bg-red-600 text-white hover:bg-red-500 disabled:opacity-60"
          >
            Delete
          </button>
        </div>
      </div>

      <form
        onSubmit={handleSave}
        className="max-w-xl space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-5"
      >
        <h2 className="text-lg font-semibold text-white">Channel Settings</h2>

        <div className="space-y-1">
          <label className="text-sm text-slate-300">Display Name</label>
          <input
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-300">WhatsApp Phone Number</label>
          <input
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="60123456789"
          />
          <p className="text-xs text-slate-500">
            Override the auto-detected number if it looks wrong.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-300">Notes</label>
          <textarea
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-300">Tags (comma separated)</label>
          <input
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="VIP, Priority, HQ"
          />
        </div>

        {success && (
          <p className="text-sm text-green-400">Channel updated successfully.</p>
        )}
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-md bg-sky-600 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
