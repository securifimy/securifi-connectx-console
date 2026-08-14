"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { useAuthStore } from "@/lib/auth-store";
import {
  apiCreateChannelApiKey,
  apiDeleteChannelApiKey,
  apiDeleteMachineKey,
  apiGetApiRequestLogs,
  apiGetChannelAccount,
  apiGetWebhookDeliveries,
  apiListChannelApiKeys,
  apiListMachineKeys,
  apiReplayWebhookDelivery,
  updateChannelAccount,
  type MachineKey,
} from "@/lib/api";

const WEBHOOK_EVENT_OPTIONS = ["inbound_message", "status_update"];

interface ChannelAccountDetails {
  id: number;
  display_name?: string | null;
  phone_number?: string | null;
  external_identifier?: string | null;
  status?: string | null;
  webhook_url?: string | null;
  webhook_events?: string[] | null;
}

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

function formatDateTime(value?: string | null): string {
  if (!value) return "Not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not yet";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

// Workspace-wide, deliberately, even though this page is one account's.
// UserKey.readers_for_tenant scopes machine keys by TENANT, not by channel
// account — a key registered on any account is a reader for every conversation
// in the workspace. Filtering this list to the current account would make the
// empty state a lie ("nobody can read this") while a key on a sibling account
// reads it fine, and would hide a leaked key from the admin hunting for it.
function machineKeysFrom(data: unknown): MachineKey[] {
  return Array.isArray(data) ? (data as MachineKey[]) : [];
}

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

function truncateText(value: string, maxLength = 100): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function statusTone(status?: string | null): string {
  const value = (status || "").toLowerCase();
  if (value === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (value === "pending" || value === "connecting") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (value === "failed" || value === "disconnected" || value === "inactive") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-border/70 bg-muted text-foreground";
}

function deliveryTone(status?: string | null): string {
  if (status === "succeeded") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "failed") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function requestTone(status: number): string {
  if (status >= 200 && status < 300) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status >= 400) {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function titleCaseStatus(status?: string | null): string {
  const value = (status || "unknown").toLowerCase();
  if (value === "active") return "Connected";
  if (value === "pending" || value === "connecting") return "Connecting";
  if (value === "disconnected") return "Disconnected";
  if (value === "inactive") return "Inactive";
  if (value === "failed") return "Failed";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-ui-border/70 bg-[hsl(var(--card))] p-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function ReadinessItem({
  title,
  ready,
  detail,
}: {
  title: string;
  ready: boolean;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-ui-border/60 bg-[hsl(var(--muted))] px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${
            ready
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          {ready ? "Ready" : "Needs setup"}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

export default function ChannelDeveloperPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const channelAccountId = Number(params?.id);

  const [channel, setChannel] = useState<ChannelAccountDetails | null>(null);
  const [keys, setKeys] = useState<ChannelApiKey[]>([]);
  const [machineKeys, setMachineKeys] = useState<MachineKey[]>([]);
  const [logs, setLogs] = useState<ApiRequestLog[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [newKeyRaw, setNewKeyRaw] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [keyLoading, setKeyLoading] = useState(false);

  useEffect(() => {
    if (!token || Number.isNaN(channelAccountId)) {
      router.replace("/app/channels");
      return;
    }

    let cancelled = false;

    async function loadAll(mode: "initial" | "refresh" = "initial") {
      if (mode === "initial") {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      try {
        const authToken = token as string;
        const [keyData, logData, deliveryData, channelData, machineKeyData] = await Promise.all([
          apiListChannelApiKeys(authToken, channelAccountId),
          apiGetApiRequestLogs(authToken, channelAccountId),
          apiGetWebhookDeliveries(authToken, channelAccountId),
          apiGetChannelAccount(authToken, channelAccountId),
          apiListMachineKeys(authToken),
        ]);

        if (cancelled) return;

        setChannel(channelData as ChannelAccountDetails);
        setKeys(Array.isArray(keyData) ? keyData.filter((key: ChannelApiKey) => !key.disabled) : []);
        setMachineKeys(machineKeysFrom(machineKeyData));
        setLogs(logData as ApiRequestLog[]);
        setDeliveries(deliveryData as WebhookDelivery[]);
        setWebhookUrl(((channelData as ChannelAccountDetails).webhook_url || "") as string);
        setWebhookEvents(((channelData as ChannelAccountDetails).webhook_events || []) as string[]);
      } catch (err) {
        console.error("Failed to load developer data", err);
        if (!cancelled) setError("Failed to load developer data");
      } finally {
        if (!cancelled) {
          if (mode === "initial") {
            setLoading(false);
          } else {
            setRefreshing(false);
          }
        }
      }
    }

    loadAll("initial");
    return () => {
      cancelled = true;
    };
  }, [token, channelAccountId, router]);

  if (Number.isNaN(channelAccountId)) {
    return (
      <WorkspaceShell
        activeNav="channels"
        header={{
          title: "Developer",
          subtitle: "Integration controls, webhook routing, and request diagnostics for this channel.",
        }}
      >
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Invalid channel ID.
        </div>
      </WorkspaceShell>
    );
  }

  async function refreshLists() {
    if (!token) return;
    setRefreshing(true);
    try {
      const authToken = token as string;
      const [keyData, logData, deliveryData, channelData, machineKeyData] = await Promise.all([
        apiListChannelApiKeys(authToken, channelAccountId),
        apiGetApiRequestLogs(authToken, channelAccountId),
        apiGetWebhookDeliveries(authToken, channelAccountId),
        apiGetChannelAccount(authToken, channelAccountId),
        apiListMachineKeys(authToken),
      ]);
      setChannel(channelData as ChannelAccountDetails);
      setKeys(Array.isArray(keyData) ? keyData.filter((key: ChannelApiKey) => !key.disabled) : []);
      setMachineKeys(machineKeysFrom(machineKeyData));
      setLogs(logData as ApiRequestLog[]);
      setDeliveries(deliveryData as WebhookDelivery[]);
      setWebhookUrl(((channelData as ChannelAccountDetails).webhook_url || "") as string);
      setWebhookEvents(((channelData as ChannelAccountDetails).webhook_events || []) as string[]);
    } catch (err) {
      console.error("Failed to refresh developer data", err);
      setError("Failed to refresh developer data");
    } finally {
      setRefreshing(false);
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
      setCopied(false);
      setNewKeyLabel("");
      await refreshLists();
    } catch (err) {
      console.error("Failed to create API key", err);
      setError("Failed to create API key");
    } finally {
      setKeyLoading(false);
    }
  }

  async function handleCopyKey() {
    if (!newKeyRaw) return;
    try {
      await navigator.clipboard.writeText(newKeyRaw);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy API key", err);
      setError("Failed to copy API key");
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

  async function handleRemoveMachineKey(key: MachineKey) {
    if (!token) return;
    const label = key.label || key.kid;
    const confirmed = window.confirm(
      `Remove "${label}"?\n\n` +
        "That integration stops being able to read history sealed after this moment. " +
        "Nothing already sealed to it changes — whatever it can read today, it can still read."
    );
    if (!confirmed) return;
    try {
      await apiDeleteMachineKey(token, key.id);
      await refreshLists();
    } catch (err) {
      console.error("Failed to remove machine reader", err);
      setError("Failed to remove machine reader");
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
      prev.includes(event) ? prev.filter((existing) => existing !== event) : [...prev, event]
    );
  };

  async function handleSaveWebhook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setWebhookSaving(true);
    setError(null);
    try {
      const updated = (await updateChannelAccount(token, channelAccountId, {
        webhook_url: webhookUrl || null,
        webhook_events: webhookEvents,
      })) as ChannelAccountDetails;
      setChannel(updated);
    } catch (err) {
      console.error("Failed to update webhook settings", err);
      setError("Failed to update webhook settings");
    } finally {
      setWebhookSaving(false);
    }
  }

  const activeKeyCount = keys.length;
  const requestsWithSuccess = logs.filter((log) => log.status >= 200 && log.status < 300).length;
  const requestSuccessRate = logs.length > 0 ? Math.round((requestsWithSuccess / logs.length) * 100) : 0;
  const averageLatency =
    logs.length > 0
      ? Math.round(
          logs.reduce((sum, log) => sum + (typeof log.duration_ms === "number" ? log.duration_ms : 0), 0) /
            logs.length
        )
      : 0;
  const successfulDeliveries = deliveries.filter((delivery) => delivery.status === "succeeded").length;
  const deliverySuccessRate = deliveries.length > 0 ? Math.round((successfulDeliveries / deliveries.length) * 100) : 0;

  const apiKeyReady = activeKeyCount > 0;
  const webhookReady = Boolean(webhookUrl);
  const liveSessionReady = (channel?.status || "").toLowerCase() === "active";
  const deliveryReplayNeeded = deliveries.some((delivery) => delivery.status !== "succeeded");
  const developerSubtitle = channel?.display_name
    ? `Integration controls, webhook routing, and request diagnostics for ${channel.display_name}.`
    : "Integration controls, webhook routing, and request diagnostics for this channel.";
  const accountLabel = channel?.display_name || channel?.phone_number || channel?.external_identifier || `Account ${channelAccountId}`;

  return (
    <WorkspaceShell
      activeNav="channels"
      header={{
        title: "Developer",
        subtitle: developerSubtitle,
      }}
    >
      {loading ? (
        <div className="space-y-4">
          <div className="h-40 animate-pulse rounded-3xl border border-ui-border/70 bg-[hsl(var(--muted))]" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="h-32 animate-pulse rounded-2xl border border-ui-border/70 bg-[hsl(var(--muted))]"
              />
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            <div className="h-[38rem] animate-pulse rounded-2xl border border-ui-border/70 bg-[hsl(var(--muted))]" />
            <div className="h-[38rem] animate-pulse rounded-2xl border border-ui-border/70 bg-[hsl(var(--muted))]" />
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <Link href="/app/channels" className="hover:text-foreground">
                Channels
              </Link>
              <span>/</span>
              <Link href={`/app/channels/${channelAccountId}`} className="hover:text-foreground">
                {accountLabel}
              </Link>
              <span>/</span>
              <span className="text-foreground">Developer</span>
            </div>
            <button
              type="button"
              onClick={refreshLists}
              disabled={refreshing}
              className="inline-flex items-center rounded-lg border border-ui-border bg-[hsl(var(--card))] px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh developer data"}
            </button>
          </div>

          <section className="relative overflow-hidden rounded-[28px] border border-ui-border/70 bg-[linear-gradient(135deg,hsl(var(--card))_0%,hsl(var(--muted))_55%,hsl(var(--card))_100%)] p-6 shadow-sm md:p-8">
            <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.16)_0%,transparent_70%)]" />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(
                      channel?.status
                    )}`}
                  >
                    {titleCaseStatus(channel?.status)}
                  </span>
                  <span className="inline-flex rounded-full border border-ui-border/70 bg-white/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                    Account ID {channelAccountId}
                  </span>
                </div>
                <p className="mt-5 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Routing number {channel?.phone_number || channel?.external_identifier || "not detected"}.
                  {" "}Use this page to manage integration credentials, webhook delivery, and replay decisions.
                </p>
              </div>
              <Link
                href={`/app/channels/${channelAccountId}`}
                className="inline-flex items-center rounded-lg border border-ui-border bg-white px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted"
              >
                Open account view
              </Link>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Active API keys"
              value={formatCount(activeKeyCount)}
              detail="Usable keys for programmatic send and read access."
            />
            <MetricCard
              label="Webhook success"
              value={`${deliverySuccessRate}%`}
              detail={`${formatCount(successfulDeliveries)} of ${formatCount(deliveries.length)} recent deliveries succeeded.`}
            />
            <MetricCard
              label="API request success"
              value={`${requestSuccessRate}%`}
              detail={`${formatCount(requestsWithSuccess)} of ${formatCount(logs.length)} recent requests returned 2xx.`}
            />
            <MetricCard
              label="Avg API latency"
              value={logs.length > 0 ? `${formatCount(averageLatency)} ms` : "No data"}
              detail="Average response time across recent authenticated requests."
            />
          </section>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            <div className="space-y-6">
              <section className="rounded-2xl border border-ui-border/70 bg-[hsl(var(--card))] p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">API keys</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Provision, rotate, and inspect keys used by your external systems.
                    </p>
                  </div>
                </div>

                {newKeyRaw && (
                  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-amber-900">New API key</p>
                        <p className="mt-1 text-sm text-amber-800">
                          This value will not be shown again after you leave this page.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyKey}
                        className="inline-flex items-center rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
                      >
                        {copied ? "Copied" : "Copy key"}
                      </button>
                    </div>
                    <code className="mt-3 block break-all rounded-xl bg-white px-3 py-3 text-sm text-foreground">
                      {newKeyRaw}
                    </code>
                  </div>
                )}

                <div className="mt-5 flex flex-col gap-3 md:flex-row">
                  <input
                    className="flex-1 rounded-xl border border-ui-border bg-white px-3 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-[hsl(var(--primary)/0.18)]"
                    placeholder="Label (e.g. CRM integration)"
                    value={newKeyLabel}
                    onChange={(event) => setNewKeyLabel(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleCreateKey}
                    disabled={keyLoading}
                    className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-[hsl(var(--primary-dark))] disabled:opacity-60"
                  >
                    {keyLoading ? "Creating..." : "Create API key"}
                  </button>
                </div>

                <div className="mt-5 overflow-x-auto rounded-2xl border border-ui-border/60">
                  <table className="w-full text-sm">
                    <thead className="bg-[hsl(var(--muted))] text-left text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Label</th>
                        <th className="px-4 py-3">Scopes</th>
                        <th className="px-4 py-3">Last used</th>
                        <th className="px-4 py-3">Daily / Monthly</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keys.map((key) => (
                        <tr key={key.id} className="border-t border-ui-border/60 bg-white">
                          <td className="px-4 py-3 font-medium text-foreground">{key.label}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {Array.isArray(key.scopes) && key.scopes.length > 0 ? key.scopes.join(", ") : "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDateTime(key.last_used_at)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatCount(key.daily_count ?? 0)} / {formatCount(key.monthly_count ?? 0)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteKey(key.id)}
                              className="text-sm font-medium text-red-600 hover:text-red-700"
                            >
                              Disable
                            </button>
                          </td>
                        </tr>
                      ))}
                      {keys.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                            No API keys yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-2xl border border-ui-border/70 bg-[hsl(var(--card))] p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-foreground">Machine readers</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Integrations enrolled to read this workspace&apos;s message history — a reader
                  registered on any channel account can read every conversation in the workspace,
                  so they are all listed here. Removing one only affects history sealed from that
                  point on.
                </p>

                <div className="mt-5 overflow-x-auto rounded-2xl border border-ui-border/60">
                  <table className="w-full text-sm">
                    <thead className="bg-[hsl(var(--muted))] text-left text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Label</th>
                        <th className="px-4 py-3">Created</th>
                        <th className="px-4 py-3">Last used</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {machineKeys.map((key) => (
                        <tr key={key.id} className="border-t border-ui-border/60 bg-white">
                          <td className="px-4 py-3 font-medium text-foreground">{key.label || key.kid}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDateTime(key.created_at)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDateTime(key.last_used_at)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveMachineKey(key)}
                              className="text-sm font-medium text-red-600 hover:text-red-700"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                      {machineKeys.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                            No integrations can read this workspace&apos;s history.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-2xl border border-ui-border/70 bg-[hsl(var(--card))] p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-foreground">Webhook settings</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Configure where inbound and status events are delivered outside the workspace.
                </p>

                <form onSubmit={handleSaveWebhook} className="mt-6 space-y-5">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-foreground">Webhook URL</span>
                    <input
                      type="url"
                      className="w-full rounded-xl border border-ui-border bg-white px-3 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-[hsl(var(--primary)/0.18)]"
                      placeholder="https://example.com/webhooks"
                      value={webhookUrl}
                      onChange={(event) => setWebhookUrl(event.target.value)}
                    />
                  </label>

                  <div className="space-y-2">
                    <span className="text-sm font-medium text-foreground">Events</span>
                    <div className="flex flex-wrap gap-3">
                      {WEBHOOK_EVENT_OPTIONS.map((eventName) => {
                        const enabled = webhookEvents.includes(eventName);
                        return (
                          <button
                            key={eventName}
                            type="button"
                            onClick={() => toggleWebhookEvent(eventName)}
                            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                              enabled
                                ? "border-primary bg-[hsl(var(--primary)/0.10)] text-primary"
                                : "border-ui-border bg-white text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {eventName}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={webhookSaving}
                      className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-[hsl(var(--primary-dark))] disabled:opacity-60"
                    >
                      {webhookSaving ? "Saving..." : "Save webhook settings"}
                    </button>
                    <span className="text-sm text-muted-foreground">
                      Events are only delivered when this account is connected.
                    </span>
                  </div>
                </form>
              </section>

              <section className="rounded-2xl border border-ui-border/70 bg-[hsl(var(--card))] p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-foreground">Webhook deliveries</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Recent delivery attempts, replay controls, and downstream response codes.
                </p>

                <div className="mt-5 overflow-x-auto rounded-2xl border border-ui-border/60">
                  <table className="w-full text-sm">
                    <thead className="bg-[hsl(var(--muted))] text-left text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Time</th>
                        <th className="px-4 py-3">Event</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Attempts</th>
                        <th className="px-4 py-3">Response</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveries.map((delivery) => (
                        <tr key={delivery.id} className="border-t border-ui-border/60 bg-white align-top">
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDateTime(delivery.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">{delivery.event}</div>
                            {delivery.error_message && (
                              <div className="mt-1 text-xs text-red-600">
                                {truncateText(delivery.error_message)}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${deliveryTone(
                                delivery.status
                              )}`}
                            >
                              {delivery.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{delivery.attempts}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {delivery.response_status ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {delivery.status !== "succeeded" ? (
                              <button
                                type="button"
                                onClick={() => handleReplayWebhook(delivery.id)}
                                className="text-sm font-medium text-primary hover:opacity-80"
                              >
                                Replay
                              </button>
                            ) : (
                              <span className="text-sm text-muted-foreground">Delivered</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {deliveries.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                            No webhook deliveries yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-2xl border border-ui-border/70 bg-[hsl(var(--card))] p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-foreground">API request logs</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Recent authenticated requests against this account&apos;s public API surface.
                </p>

                <div className="mt-5 overflow-x-auto rounded-2xl border border-ui-border/60">
                  <table className="w-full text-sm">
                    <thead className="bg-[hsl(var(--muted))] text-left text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Time</th>
                        <th className="px-4 py-3">Method</th>
                        <th className="px-4 py-3">Endpoint</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="border-t border-ui-border/60 bg-white">
                          <td className="px-4 py-3 text-muted-foreground">{formatDateTime(log.created_at)}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-md bg-[hsl(var(--muted))] px-2 py-1 text-[11px] font-semibold text-foreground">
                              {log.http_method}
                            </span>
                          </td>
                          <td className="px-4 py-3 break-all font-medium text-foreground">{log.endpoint}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${requestTone(
                                log.status
                              )}`}
                            >
                              {log.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {typeof log.duration_ms === "number" ? `${Math.round(log.duration_ms)} ms` : "—"}
                          </td>
                        </tr>
                      ))}
                      {logs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                            No API logs yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section className="rounded-2xl border border-ui-border/70 bg-[hsl(var(--card))] p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-foreground">Developer readiness</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Quick checks before you hand this account to an integration or automation team.
                </p>

                <div className="mt-5 space-y-3">
                  <ReadinessItem
                    title="Live session"
                    ready={liveSessionReady}
                    detail={
                      liveSessionReady
                        ? "WhatsApp session is connected and ready to send."
                        : "Reconnect the account before testing API sends or webhooks."
                    }
                  />
                  <ReadinessItem
                    title="API key provisioned"
                    ready={apiKeyReady}
                    detail={
                      apiKeyReady
                        ? `${formatCount(activeKeyCount)} API key${activeKeyCount === 1 ? "" : "s"} available for integrations.`
                        : "Create an API key before external systems attempt to call this account."
                    }
                  />
                  <ReadinessItem
                    title="Webhook routing"
                    ready={webhookReady}
                    detail={
                      webhookReady
                        ? `Webhook events will post to ${webhookUrl}.`
                        : "No webhook URL configured for inbound or status callbacks."
                    }
                  />
                  <ReadinessItem
                    title="Delivery review"
                    ready={!deliveryReplayNeeded}
                    detail={
                      deliveryReplayNeeded
                        ? "Recent failed deliveries exist. Review and replay them before go-live."
                        : "Recent webhook deliveries are healthy."
                    }
                  />
                </div>
              </section>

            </div>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
