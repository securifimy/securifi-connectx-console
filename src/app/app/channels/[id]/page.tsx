"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { useAuthStore } from "@/lib/auth-store";
import {
  apiDeleteChannelAccount,
  apiDisconnectChannelAccount,
  apiGetChannelAccount,
  apiGetChannelUsage,
  updateChannelAccount,
} from "@/lib/api";

interface ChannelAccountDetails {
  id: number;
  channel_id: number;
  display_name?: string | null;
  external_identifier?: string | null;
  phone_number?: string | null;
  status?: string | null;
  connected_at?: string | null;
  metadata?: Record<string, unknown> | null;
  config?: Record<string, unknown> | null;
  api_key_label?: string | null;
  api_key_last_used_at?: string | null;
  api_key_scopes?: string[] | null;
  webhook_url?: string | null;
  webhook_events?: string[] | null;
}

interface UsageTrendPoint {
  date: string;
  inbound_message: number;
  outbound_message: number;
  api_call: number;
  total_messages: number;
}

interface ChannelUsageResponse {
  channel_account_id: number;
  usage?: Record<string, number>;
  series?: UsageTrendPoint[];
  window_days?: {
    summary?: number;
    trend?: number;
  };
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "1" || trimmed.toLowerCase() === "unknown") {
    return null;
  }
  return trimmed;
}

function readString(source: Record<string, unknown> | null | undefined, key: string): string | null {
  return normalizeText(source?.[key]);
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
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

function formatShortDay(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
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

function InfoRow({
  label,
  value,
  subtle = false,
}: {
  label: string;
  value: string;
  subtle?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ui-border/60 py-3 last:border-b-0 last:pb-0 first:pt-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`max-w-[60%] text-right text-sm ${
          subtle ? "text-muted-foreground" : "font-medium text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function ReadinessItem({
  title,
  detail,
  ready,
}: {
  title: string;
  detail: string;
  ready: boolean;
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

function TrendChart({
  series,
  trendDays,
}: {
  series: UsageTrendPoint[];
  trendDays: number;
}) {
  const maxMessages = Math.max(...series.map((point) => point.total_messages), 0);
  const maxApiCalls = Math.max(...series.map((point) => point.api_call), 0);

  return (
    <section className="rounded-2xl border border-ui-border/70 bg-[hsl(var(--card))] p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Daily activity trend</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Last {trendDays} days of message traffic. This page stays focused on operational volume, not raw integration logs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Inbound
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
            Outbound
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
            API calls
          </span>
        </div>
      </div>

      {series.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-ui-border/70 bg-[hsl(var(--muted))] p-8 text-center text-sm text-muted-foreground">
          No usage activity recorded yet for this account.
        </div>
      ) : (
        <div className="mt-6">
          <div className="grid grid-cols-7 gap-3 md:grid-cols-14">
            {series.map((point) => {
              const totalHeight =
                maxMessages > 0
                  ? Math.max((point.total_messages / maxMessages) * 100, point.total_messages > 0 ? 10 : 4)
                  : 4;
              const inboundHeight =
                point.total_messages > 0 ? (point.inbound_message / point.total_messages) * 100 : 0;
              const outboundHeight =
                point.total_messages > 0 ? (point.outbound_message / point.total_messages) * 100 : 0;
              const apiWidth =
                maxApiCalls > 0
                  ? Math.max((point.api_call / maxApiCalls) * 100, point.api_call > 0 ? 12 : 4)
                  : 4;

              return (
                <div
                  key={point.date}
                  className="rounded-xl border border-ui-border/50 bg-[hsl(var(--muted))] px-2 py-3"
                  title={`${formatShortDay(point.date)}: ${point.inbound_message} inbound, ${point.outbound_message} outbound, ${point.api_call} API calls`}
                >
                  <div className="flex h-40 items-end justify-center">
                    <div className="flex h-full w-full items-end justify-center">
                      <div
                        className="flex w-full flex-col justify-end overflow-hidden rounded-t-xl border border-ui-border/60 bg-white"
                        style={{ height: `${totalHeight}%` }}
                      >
                        {point.outbound_message > 0 && (
                          <div className="bg-sky-500" style={{ height: `${outboundHeight}%` }} />
                        )}
                        {point.inbound_message > 0 && (
                          <div className="bg-emerald-500" style={{ height: `${inboundHeight}%` }} />
                        )}
                        {point.total_messages === 0 && <div className="h-full bg-slate-200" />}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 text-center">
                    <p className="text-[11px] font-semibold text-foreground">{formatShortDay(point.date)}</p>
                    <p className="text-[11px] text-muted-foreground">{formatCount(point.total_messages)} msgs</p>
                    <div className="mx-auto h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-slate-400" style={{ width: `${apiWidth}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground">{formatCount(point.api_call)} API</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

export default function ChannelDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { token } = useAuthStore();
  const channelId = Number(params?.id);

  const [channel, setChannel] = useState<ChannelAccountDetails | null>(null);
  const [usage, setUsage] = useState<ChannelUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [displayName, setDisplayName] = useState("");

  const loadChannel = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (!token || Number.isNaN(channelId)) {
        router.replace("/app/channels");
        return;
      }

      if (mode === "initial") {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError(null);

      try {
        const authToken = token as string;
        const [channelResult, usageResult] = await Promise.allSettled([
          apiGetChannelAccount(authToken, channelId),
          apiGetChannelUsage(authToken, channelId),
        ]);

        if (channelResult.status === "rejected") {
          throw channelResult.reason;
        }

        const data = channelResult.value as ChannelAccountDetails;
        setChannel(data);
        setDisplayName(data.display_name || "");

        const metadata = (data.metadata || {}) as Record<string, unknown>;
        setNotes(typeof metadata.notes === "string" ? metadata.notes : "");
        setTags(readStringArray(metadata.tags).join(", "));
        setPhoneNumber(data.phone_number || "");

        if (usageResult.status === "fulfilled") {
          setUsage(usageResult.value as ChannelUsageResponse);
          setUsageError(null);
        } else {
          setUsage(null);
          setUsageError("30-day usage is temporarily unavailable.");
        }
      } catch (err) {
        console.error("Failed to load channel account", err);
        setError("Failed to load channel");
      } finally {
        if (mode === "initial") {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [token, channelId, router]
  );

  useEffect(() => {
    loadChannel("initial");
  }, [loadChannel]);

  const host = useMemo(() => {
    if (!channel?.config || typeof channel.config !== "object") return null;
    const value = channel.config.host;
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  }, [channel]);

  const hostRaw = useMemo(() => {
    if (!host) return null;
    const value = host.raw;
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  }, [host]);

  const detectedPhone = useMemo(() => {
    if (!channel) return null;
    if (normalizeText(channel.phone_number)) return normalizeText(channel.phone_number);
    if (normalizeText(channel.external_identifier)) return normalizeText(channel.external_identifier);
    if (readString(host, "phone")) return readString(host, "phone");
    if (readString(host, "number")) return readString(host, "number");
    if (readString(host, "wid")) return readString(host, "wid");

    const wid = host?.wid;
    if (wid && typeof wid === "object") {
      const serialized = normalizeText((wid as Record<string, unknown>)._serialized);
      if (serialized) return serialized;
    }

    return null;
  }, [channel, host]);

  const linkedProfileName = useMemo(() => {
    return readString(host, "pushname") || readString(hostRaw, "pushname") || null;
  }, [host, hostRaw]);

  const tagsList = useMemo(() => {
    const metadata = (channel?.metadata || {}) as Record<string, unknown>;
    return readStringArray(metadata.tags);
  }, [channel]);

  const usageMap = useMemo(() => usage?.usage || {}, [usage]);
  const trendSeries = useMemo(() => (Array.isArray(usage?.series) ? usage.series : []), [usage]);
  const outboundCount = Number(usageMap.outbound_message || 0);
  const inboundCount = Number(usageMap.inbound_message || 0);
  const apiCallCount = Number(usageMap.api_call || 0);
  const totalMessages = outboundCount + inboundCount;
  const trendDays = Number(usage?.window_days?.trend || trendSeries.length || 14);

  const apiScopes = readStringArray(channel?.api_key_scopes);
  const webhookEvents = readStringArray(channel?.webhook_events);
  const apiKeyReady = Boolean(channel?.api_key_label);
  const webhookReady = Boolean(channel?.webhook_url);
  const sendReady = (channel?.status || "").toLowerCase() === "active";
  const identityReady = Boolean(detectedPhone || linkedProfileName);
  const accountLabel = channel?.display_name || linkedProfileName || (Number.isNaN(channelId) ? "WhatsApp Channel" : `Channel ${channelId}`);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !channel) return;
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
      const updated = (await updateChannelAccount(
        token as string,
        channel.id,
        payload
      )) as ChannelAccountDetails;
      setChannel(updated);
      setSuccess(true);
      window.setTimeout(() => setSuccess(false), 2500);
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
    setError(null);

    try {
      const updated = (await apiDisconnectChannelAccount(
        token as string,
        channel.id
      )) as ChannelAccountDetails;
      setChannel(updated);
      setDisplayName(updated.display_name || "");
      setPhoneNumber(updated.phone_number || "");
    } catch (err) {
      console.error("Failed to disconnect channel", err);
      setError("Failed to disconnect channel");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!token || !channel) return;
    if (!window.confirm("Delete this WhatsApp channel permanently?")) return;
    setSaving(true);
    setError(null);

    try {
      await apiDeleteChannelAccount(token as string, channel.id);
      router.replace("/app/channels");
    } catch (err) {
      console.error("Failed to delete channel", err);
      setError("Failed to delete channel");
    } finally {
      setSaving(false);
    }
  }

  return (
    <WorkspaceShell
      activeNav="channels"
      header={{
        title: accountLabel,
        subtitle: "Operational view for this channel's connection health, traffic trends, and workspace ownership details.",
      }}
    >
      {Number.isNaN(channelId) ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Invalid channel ID.
        </div>
      ) : loading ? (
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
          <div className="h-[24rem] animate-pulse rounded-2xl border border-ui-border/70 bg-[hsl(var(--muted))]" />
          <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
            <div className="h-[36rem] animate-pulse rounded-2xl border border-ui-border/70 bg-[hsl(var(--muted))]" />
            <div className="h-[24rem] animate-pulse rounded-2xl border border-ui-border/70 bg-[hsl(var(--muted))]" />
          </div>
        </div>
      ) : !channel ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error || "Channel not found."}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <Link href="/app/channels" className="hover:text-foreground">
                Channels
              </Link>
              <span>/</span>
              <span className="text-foreground">{accountLabel}</span>
            </div>
            <button
              type="button"
              onClick={() => loadChannel("refresh")}
              disabled={refreshing}
              className="inline-flex items-center rounded-lg border border-ui-border bg-[hsl(var(--card))] px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh state"}
            </button>
          </div>

          <section className="relative overflow-hidden rounded-[28px] border border-ui-border/70 bg-[linear-gradient(135deg,hsl(var(--card))_0%,hsl(var(--muted))_55%,hsl(var(--card))_100%)] p-6 shadow-sm md:p-8">
            <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.16)_0%,transparent_70%)]" />
            <div className="absolute -bottom-10 left-10 h-36 w-36 rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.10)_0%,transparent_72%)]" />

            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(
                      channel.status
                    )}`}
                  >
                    {titleCaseStatus(channel.status)}
                  </span>
                  <span className="inline-flex rounded-full border border-ui-border/70 bg-white/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                    Account ID {channel.id}
                  </span>
                  <span className="inline-flex rounded-full border border-ui-border/70 bg-white/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                    Channel {channel.channel_id}
                  </span>
                </div>

                <p className="mt-5 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Linked profile {linkedProfileName || "not exposed yet"}.
                  {" "}Routing number {detectedPhone || "not detected"}.
                  {" "}Last healthy connection {formatDateTime(channel.connected_at)}.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {tagsList.length > 0 ? (
                    tagsList.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-ui-border/70 bg-white/70 px-3 py-1 text-xs font-medium text-foreground"
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full border border-ui-border/70 bg-white/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                      No channel tags yet
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:max-w-sm lg:justify-end">
                <Link
                  href={`/app/channels/${channel.id}/developer`}
                  className="inline-flex items-center rounded-lg border border-ui-border bg-white px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted"
                >
                  Developer
                </Link>
                {channel.status !== "active" && (
                  <Link
                    href={`/app/channels/${channel.id}/connect`}
                    className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-[hsl(var(--primary-dark))]"
                  >
                    {channel.status === "disconnected" ? "Reconnect" : "Open connect"}
                  </Link>
                )}
                {channel.status === "active" && (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={saving}
                    className="inline-flex items-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-400 disabled:opacity-60"
                  >
                    Disconnect
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="inline-flex items-center rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-400 disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="30-day messages"
              value={formatCount(totalMessages)}
              detail={`${formatCount(inboundCount)} inbound + ${formatCount(outboundCount)} outbound`}
            />
            <MetricCard
              label="Outbound sends"
              value={formatCount(outboundCount)}
              detail="Accepted by the send pipeline in the last 30 days."
            />
            <MetricCard
              label="Inbound replies"
              value={formatCount(inboundCount)}
              detail="Messages received into this account in the last 30 days."
            />
            <MetricCard
              label="API calls"
              value={formatCount(apiCallCount)}
              detail="Developer traffic count only. Raw request detail lives on the developer page."
            />
          </section>

          <TrendChart series={trendSeries} trendDays={trendDays} />

          {usageError && <p className="text-sm text-amber-700">{usageError}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-emerald-700">Channel updated successfully.</p>}

          <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
            <div className="space-y-6">
              <section className="rounded-2xl border border-ui-border/70 bg-[hsl(var(--card))] p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-foreground">Connection overview</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  This page owns live session facts, routing identity, and account-level traffic.
                </p>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <div>
                    <InfoRow label="Session status" value={titleCaseStatus(channel.status)} />
                    <InfoRow label="Last connected" value={formatDateTime(channel.connected_at)} />
                    <InfoRow
                      label="Linked profile"
                      value={linkedProfileName || "Not exposed by the engine yet"}
                      subtle={!linkedProfileName}
                    />
                    <InfoRow
                      label="WhatsApp number"
                      value={detectedPhone || "No number detected yet"}
                      subtle={!detectedPhone}
                    />
                  </div>
                  <div>
                    <InfoRow
                      label="Display name"
                      value={channel.display_name || "Unnamed account"}
                      subtle={!channel.display_name}
                    />
                    <InfoRow
                      label="External identifier"
                      value={normalizeText(channel.external_identifier) || "No external identifier stored"}
                      subtle={!normalizeText(channel.external_identifier)}
                    />
                    <InfoRow label="Account ID" value={String(channel.id)} />
                    <InfoRow label="Parent channel ID" value={String(channel.channel_id)} />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-ui-border/70 bg-[hsl(var(--card))] p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-foreground">Workspace metadata</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Operator-facing details for naming, routing overrides, and internal notes.
                </p>

                <form onSubmit={handleSave} className="mt-6 space-y-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-foreground">Display name</span>
                      <input
                        className="w-full rounded-xl border border-ui-border bg-white px-3 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-[hsl(var(--primary)/0.18)]"
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        placeholder="Main support account"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-foreground">Phone override</span>
                      <input
                        className="w-full rounded-xl border border-ui-border bg-white px-3 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-[hsl(var(--primary)/0.18)]"
                        value={phoneNumber}
                        onChange={(event) => setPhoneNumber(event.target.value)}
                        placeholder="60123456789"
                      />
                      <span className="block text-xs text-muted-foreground">
                        Use only if the engine-reported number is missing or wrong.
                      </span>
                    </label>
                  </div>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-foreground">Internal notes</span>
                    <textarea
                      className="min-h-32 w-full rounded-xl border border-ui-border bg-white px-3 py-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-[hsl(var(--primary)/0.18)]"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Ownership, escalation policy, shift notes, or any operator context."
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-foreground">Tags</span>
                    <input
                      className="w-full rounded-xl border border-ui-border bg-white px-3 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-[hsl(var(--primary)/0.18)]"
                      value={tags}
                      onChange={(event) => setTags(event.target.value)}
                      placeholder="sales, vip, malaysia"
                    />
                    <span className="block text-xs text-muted-foreground">
                      Comma-separated labels used by operators inside the workspace.
                    </span>
                  </label>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-[hsl(var(--primary-dark))] disabled:opacity-60"
                    >
                      {saving ? "Saving..." : "Save changes"}
                    </button>
                    <span className="text-sm text-muted-foreground">
                      Changes here do not restart the WhatsApp session.
                    </span>
                  </div>
                </form>
              </section>
            </div>

            <div className="space-y-6">
              <section className="rounded-2xl border border-ui-border/70 bg-[hsl(var(--card))] p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-foreground">Operational readiness</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Quick checks for session health and routing confidence.
                </p>

                <div className="mt-5 space-y-3">
                  <ReadinessItem
                    title="Live message sending"
                    ready={sendReady}
                    detail={
                      sendReady
                        ? "Session is active and should be ready for outbound messaging."
                        : "Reconnect this account before relying on it for outbound traffic."
                    }
                  />
                  <ReadinessItem
                    title="Account identity"
                    ready={identityReady}
                    detail={
                      identityReady
                        ? `Profile ${linkedProfileName || detectedPhone} is visible to the workspace.`
                        : "The engine has not exposed a reliable number or profile name yet."
                    }
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-ui-border/70 bg-[hsl(var(--card))] p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-foreground">Developer surface</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Integration setup is summarized here, but raw API and webhook detail lives on the developer page.
                </p>

                <div className="mt-5">
                  <InfoRow
                    label="API access"
                    value={apiKeyReady ? channel.api_key_label || "Configured" : "Not configured"}
                    subtle={!apiKeyReady}
                  />
                  <InfoRow
                    label="API last used"
                    value={formatDateTime(channel.api_key_last_used_at)}
                    subtle={!channel.api_key_last_used_at}
                  />
                  <InfoRow
                    label="Webhook"
                    value={webhookReady ? "Configured" : "Not configured"}
                    subtle={!webhookReady}
                  />
                  <InfoRow
                    label="Webhook events"
                    value={webhookEvents.length > 0 ? webhookEvents.join(", ") : "No events selected"}
                    subtle={webhookEvents.length === 0}
                  />
                  <InfoRow
                    label="API scopes"
                    value={apiScopes.length > 0 ? apiScopes.join(", ") : "No scopes configured"}
                    subtle={apiScopes.length === 0}
                  />
                </div>

                <Link
                  href={`/app/channels/${channel.id}/developer`}
                  className="mt-5 inline-flex items-center rounded-lg border border-ui-border bg-white px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted"
                >
                  Open developer workspace
                </Link>
              </section>
            </div>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
