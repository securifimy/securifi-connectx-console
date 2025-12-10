"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import {
  apiCreateChannelApiKey,
  apiDeleteChannelApiKey,
  apiGetApiRequestLogs,
  apiGetChannelAccount,
  apiGetWebhookDeliveries,
  apiListChannelApiKeys,
  apiReplayWebhookDelivery,
  updateChannelAccount,
} from "@/lib/api";

const WEBHOOK_EVENT_OPTIONS = ["inbound_message", "status_update"];

interface ChannelApiKey {
  id: number;
  label: string;
  scopes: string[];
  last_used_at?: string | null;
  disabled?: boolean;
  daily_count?: number;
  monthly_count?: number;
  created_at?: string;
}

interface WebhookDelivery {
  id: number;
  event: string;
  status: string;
  attempts: number;
  response_status?: number | null;
  created_at?: string | null;
  delivered_at?: string | null;
  error_message?: string | null;
  next_retry_at?: string | null;
}

interface ApiRequestLog {
  id: number;
  endpoint: string;
  http_method: string;
  status: number;
  ip?: string | null;
  duration_ms?: number | null;
  created_at?: string | null;
}

export default function ChannelDeveloperPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const channelAccountId = Number(params?.id);

  const [keys, setKeys] = useState<ChannelApiKey[]>([]);
  const [logs, setLogs] = useState<ApiRequestLog[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [newKeyRaw, setNewKeyRaw] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [keyLoading, setKeyLoading] = useState(false);

  useEffect(() => {
    if (!token || Number.isNaN(channelAccountId)) {
      router.replace("/app/channels");
      return;
    }

    let cancelled = false;

    async function loadAll() {
      setLoading(true);
      setError(null);
      try {
        const authToken = token as string;
        const [keyData, logData, deliveryData, channelData] = await Promise.all([
          apiListChannelApiKeys(authToken, channelAccountId),
          apiGetApiRequestLogs(authToken, channelAccountId),
          apiGetWebhookDeliveries(authToken, channelAccountId),
          apiGetChannelAccount(authToken, channelAccountId),
        ]);

        if (cancelled) return;
        setKeys(Array.isArray(keyData) ? keyData.filter((key: ChannelApiKey) => !key.disabled) : []);
        setLogs(logData);
        setDeliveries(deliveryData);
        setWebhookUrl(channelData.webhook_url || "");
        setWebhookEvents(channelData.webhook_events || []);
      } catch (err) {
        console.error("Failed to load developer data", err);
        if (!cancelled) setError("Failed to load developer data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [token, channelAccountId, router]);

  if (Number.isNaN(channelAccountId)) {
    return <div className="p-6 text-sm text-red-400">Invalid channel ID.</div>;
  }

  async function refreshLists() {
    if (!token) return;
    const authToken = token as string;
    try {
      const [keyData, logData, deliveryData] = await Promise.all([
        apiListChannelApiKeys(authToken, channelAccountId),
        apiGetApiRequestLogs(authToken, channelAccountId),
        apiGetWebhookDeliveries(authToken, channelAccountId),
      ]);
      setKeys(Array.isArray(keyData) ? keyData.filter((key: ChannelApiKey) => !key.disabled) : []);
      setLogs(logData);
      setDeliveries(deliveryData);
    } catch (err) {
      console.error("Failed to refresh developer data", err);
    }
  }

  async function handleCreateKey() {
    if (!token) return;
    setKeyLoading(true);
    setError(null);
    try {
      const data = await apiCreateChannelApiKey(token, channelAccountId, {
        label: newKeyLabel || "Default",
      });
      setNewKeyRaw(data.api_key);
      setNewKeyLabel("");
      await refreshLists();
    } catch (err) {
      console.error("Failed to create API key", err);
      setError("Failed to create API key");
    } finally {
      setKeyLoading(false);
    }
  }

  async function handleDeleteKey(id: number) {
    if (!token) return;
    if (!window.confirm("Disable this API key?")) return;
    try {
      await apiDeleteChannelApiKey(token, channelAccountId, id);
      await refreshLists();
    } catch (err) {
      console.error("Failed to delete API key", err);
      setError("Failed to delete API key");
    }
  }

  async function handleReplayWebhook(id: number) {
    if (!token) return;
    try {
      await apiReplayWebhookDelivery(token, id);
      await refreshLists();
    } catch (err) {
      console.error("Failed to replay webhook", err);
      setError("Failed to replay webhook");
    }
  }

  const toggleWebhookEvent = (event: string) => {
    setWebhookEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  async function handleSaveWebhook(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setWebhookSaving(true);
    setError(null);
    try {
      await updateChannelAccount(token, channelAccountId, {
        webhook_url: webhookUrl || null,
        webhook_events: webhookEvents,
      });
    } catch (err) {
      console.error("Failed to update webhook settings", err);
      setError("Failed to update webhook settings");
    } finally {
      setWebhookSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">Loading developer data…</div>;
  }

  return (
    <div className="p-6 space-y-8">
      {error && <p className="text-sm text-red-400">{error}</p>}

      <section className="border border-slate-800 rounded-xl p-4 bg-slate-900/60 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">API Keys</h2>
        </div>

        {newKeyRaw && (
          <div className="bg-yellow-100 text-yellow-900 rounded p-3 text-sm">
            <p className="font-semibold mb-1">New API key (copy now, it will not appear again):</p>
            <code className="break-all">{newKeyRaw}</code>
          </div>
        )}

        <div className="flex gap-2">
          <input
            className="flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
            placeholder="Label (e.g. CRM Integration)"
            value={newKeyLabel}
            onChange={(e) => setNewKeyLabel(e.target.value)}
          />
          <button
            onClick={handleCreateKey}
            disabled={keyLoading}
            className="px-3 py-2 text-sm rounded bg-blue-600 text-white disabled:opacity-60"
          >
            + Create API Key
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-800 text-slate-400">
                <th className="py-2">Label</th>
                <th>Scopes</th>
                <th>Last used</th>
                <th>Daily / Monthly</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-b border-slate-800">
                  <td className="py-2">{key.label}</td>
                  <td>{Array.isArray(key.scopes) ? key.scopes.join(", ") : "—"}</td>
                  <td>{key.last_used_at ? new Date(key.last_used_at).toLocaleString() : "—"}</td>
                  <td>
                    {(key.daily_count ?? 0).toLocaleString()} / {(key.monthly_count ?? 0).toLocaleString()}
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => handleDeleteKey(key.id)}
                      className="text-xs text-red-400"
                    >
                      Disable
                    </button>
                  </td>
                </tr>
              ))}
              {keys.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-500">
                    No API keys yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border border-slate-800 rounded-xl p-4 bg-slate-900/60 space-y-4">
        <h2 className="text-lg font-semibold text-white">Webhook Settings</h2>
        <form onSubmit={handleSaveWebhook} className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm text-slate-300">Webhook URL</label>
            <input
              type="url"
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              placeholder="https://example.com/webhooks"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <span className="text-sm text-slate-300">Events</span>
            <div className="flex flex-wrap gap-3 text-sm text-white">
              {WEBHOOK_EVENT_OPTIONS.map((event) => (
                <label key={event} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={webhookEvents.includes(event)}
                    onChange={() => toggleWebhookEvent(event)}
                  />
                  {event}
                </label>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={webhookSaving}
            className="px-4 py-2 rounded bg-green-600 text-white text-sm disabled:opacity-60"
          >
            Save Webhook Settings
          </button>
        </form>
      </section>

      <section className="border border-slate-800 rounded-xl p-4 bg-slate-900/60 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Webhook Deliveries</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-800 text-slate-400">
                <th className="py-2">Time</th>
                <th>Event</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Response</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((delivery) => (
                <tr key={delivery.id} className="border-b border-slate-800">
                  <td className="py-2">
                    {delivery.created_at ? new Date(delivery.created_at).toLocaleString() : "—"}
                  </td>
                  <td>{delivery.event}</td>
                  <td>{delivery.status}</td>
                  <td>{delivery.attempts}</td>
                  <td>{delivery.response_status || "—"}</td>
                  <td className="text-right">
                    {delivery.status !== "succeeded" && (
                      <button
                        onClick={() => handleReplayWebhook(delivery.id)}
                        className="text-xs text-blue-400"
                      >
                        Replay
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {deliveries.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-slate-500">
                    No webhook deliveries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border border-slate-800 rounded-xl p-4 bg-slate-900/60 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">API Request Logs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-800 text-slate-400">
                <th className="py-2">Time</th>
                <th>Method</th>
                <th>Endpoint</th>
                <th>Status</th>
                <th>Duration (ms)</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-800">
                  <td className="py-2">
                    {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                  </td>
                  <td>{log.http_method}</td>
                  <td className="break-all">{log.endpoint}</td>
                  <td>{log.status}</td>
                  <td>{Math.round(log.duration_ms ?? 0)}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-500">
                    No API logs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
