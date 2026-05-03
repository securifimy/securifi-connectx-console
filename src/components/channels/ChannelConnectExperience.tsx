"use client";

import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { useAuthStore } from "@/lib/auth-store";
import {
  apiGetChannelAccount,
  apiGetChannelAccountQr,
  apiGetChannelAccountSessionStatus,
  apiStartChannelAccountSession,
} from "@/lib/api";

const POLL_INTERVAL_MS = 2000;
const AUTO_REDIRECT_MS = 1600;

type AccountSummary = {
  id: number;
  display_name?: string | null;
  external_identifier?: string | null;
  phone_number?: string | null;
  status?: string | null;
  config?: Record<string, unknown> | null;
};

type SessionStatus = {
  status?: string | null;
  raw_status?: string | null;
  connected?: boolean;
  channel_account_status?: string | null;
  host?: Record<string, unknown> | null;
  qr_present?: boolean;
  last_update?: number | null;
};

type Props = {
  channelAccountId: number;
  title: string;
  subtitle: string;
  contextLabel: string;
  backHref: string;
  backLabel: string;
  completeHref: string;
  connectedMessage: string;
  startOnMount?: boolean;
  forceRestartOnMount?: boolean;
};

// User-triggered force-restart wipes saved tokens and respawns chromium, which
// takes ~10-15s to render the next QR. Lock the restart button for this long
// after each click so rage-clicks don't pile up multiple destructive restarts
// (each one wiping the in-flight QR generation from the prior click).
const FORCE_RESTART_COOLDOWN_MS = 30000;

function normalizeQr(value?: string | null) {
  if (!value) return null;
  return value.startsWith("data:image") ? value : `data:image/png;base64,${value}`;
}

function extractHost(config?: Record<string, unknown> | null) {
  if (!config) return null;
  const host = config["host"];
  return host && typeof host === "object" ? (host as Record<string, unknown>) : null;
}

function extractPhone(account?: AccountSummary | null, host?: Record<string, unknown> | null) {
  const fromAccount = account?.phone_number || account?.external_identifier;
  if (fromAccount) return fromAccount;

  const sources = [host, extractHost(account?.config)];
  for (const source of sources) {
    if (!source) continue;
    const raw =
      source["phone"] ||
      source["number"] ||
      source["wid"] ||
      (typeof source["wid"] === "object" && source["wid"] !== null
        ? (source["wid"] as Record<string, unknown>)["_serialized"]
        : null);
    if (typeof raw === "string" && raw.trim() !== "") {
      return raw;
    }
  }

  return null;
}

function extractPushname(account?: AccountSummary | null, host?: Record<string, unknown> | null) {
  const candidates = [host, extractHost(account?.config)];
  for (const candidate of candidates) {
    if (candidate && typeof candidate["pushname"] === "string" && candidate["pushname"].trim() !== "") {
      return candidate["pushname"] as string;
    }
  }
  return null;
}

function deriveStage(session: SessionStatus | null, qr: string | null) {
  if (session?.connected) return "connected";
  if (qr || session?.qr_present) return "scan";

  const status = String(session?.status || "").toLowerCase();
  if (status === "failed") return "failed";
  if (status === "disconnected") return "disconnected";
  if (status === "connecting" || status === "pending" || status === "authenticated" || status === "starting") {
    return "connecting";
  }

  return status || "starting";
}

function stageLabel(stage: string) {
  switch (stage) {
    case "connected":
      return "Connected";
    case "scan":
      return "Scan QR";
    case "connecting":
      return "Syncing";
    case "disconnected":
      return "Disconnected";
    case "failed":
      return "Needs attention";
    default:
      return "Starting";
  }
}

function stagePill(stage: string) {
  switch (stage) {
    case "connected":
      return "bg-emerald-50 text-emerald-700 border border-emerald-100";
    case "scan":
    case "connecting":
      return "bg-amber-50 text-amber-700 border border-amber-100";
    case "failed":
    case "disconnected":
      return "bg-red-50 text-red-600 border border-red-100";
    default:
      return "bg-muted text-foreground border border-border/60";
  }
}

function stageHeadline(stage: string) {
  switch (stage) {
    case "connected":
      return "Link complete";
    case "scan":
      return "Scan this QR code";
    case "connecting":
      return "Finishing secure link";
    case "disconnected":
      return "Session is offline";
    case "failed":
      return "Link needs attention";
    default:
      return "Preparing session";
  }
}

function stageDescription(stage: string) {
  switch (stage) {
    case "connected":
      return "WhatsApp is linked and the session is ready to use.";
    case "scan":
      return "Open WhatsApp on your phone, go to Linked Devices, and scan the QR code.";
    case "connecting":
      return "The device has been detected. We are waiting for WhatsApp to finish syncing and confirm readiness.";
    case "disconnected":
      return "The WhatsApp session is currently disconnected. Start the session again to generate a fresh QR.";
    case "failed":
      return "The engine could not complete the link. Restart the session to request a fresh QR.";
    default:
      return "Starting the WhatsApp session and requesting a fresh QR from the engine.";
  }
}

function formatUpdatedAt(value?: number | null) {
  if (!value) return "Pending";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function ChannelConnectExperience({
  channelAccountId,
  title,
  subtitle,
  contextLabel,
  backHref,
  backLabel,
  completeHref,
  connectedMessage,
  startOnMount = false,
  forceRestartOnMount = false,
}: Props) {
  const router = useRouter();
  const { token } = useAuthStore();
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [session, setSession] = useState<SessionStatus | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [pollError, setPollError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [restartCooldownUntil, setRestartCooldownUntil] = useState<number | null>(null);
  const [, setCooldownTick] = useState(0);
  const redirectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasQueuedRedirectRef = useRef(false);
  const hasRefreshedAccountOnConnectRef = useRef(false);

  const navigateToComplete = useCallback(() => {
    router.replace(completeHref);

    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        if (window.location.pathname !== completeHref) {
          window.location.replace(completeHref);
        }
      }, 500);
    }
  }, [completeHref, router]);

  const loadAccount = useCallback(async () => {
    if (!token) return;
    setLoadingAccount(true);
    try {
      const response = await apiGetChannelAccount(token, channelAccountId);
      setAccount(response);
    } catch (err) {
      console.error("Failed to load channel account", err);
    } finally {
      setLoadingAccount(false);
    }
  }, [token, channelAccountId]);

  const startSession = useCallback(
    async (clearQr = false, forceRestart = false) => {
      if (!token) return;
      setIsStarting(true);
      setActionError(null);
      if (clearQr) {
        setQr(null);
      }
      try {
        await apiStartChannelAccountSession(token, channelAccountId, {
          forceRestart,
        });
      } catch (err) {
        console.error("Failed to start WhatsApp session", err);
        setActionError("Unable to restart the WhatsApp session right now.");
      } finally {
        setIsStarting(false);
      }
    },
    [token, channelAccountId]
  );

  useEffect(() => {
    if (!token) return;
    void loadAccount();
  }, [token, loadAccount]);

  useEffect(() => {
    if (!token || !startOnMount) return;
    void startSession(false, forceRestartOnMount);
  }, [token, startOnMount, forceRestartOnMount, startSession]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const [statusRes, qrRes] = await Promise.all([
          apiGetChannelAccountSessionStatus(token, channelAccountId),
          apiGetChannelAccountQr(token, channelAccountId),
        ]);

        if (cancelled) return;

        setSession(statusRes);
        setPollError(null);
        setQr(statusRes?.connected ? null : normalizeQr(qrRes?.qr));
      } catch (err) {
        console.error("Failed to poll connect state", err);
        if (!cancelled) {
          setPollError("Unable to reach the WhatsApp engine. Retrying automatically.");
        }
      }
    };

    void poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token, channelAccountId]);

  const stage = useMemo(() => deriveStage(session, qr), [session, qr]);
  const detectedPhone = useMemo(() => extractPhone(account, session?.host || null), [account, session?.host]);
  const detectedPushname = useMemo(() => extractPushname(account, session?.host || null), [account, session?.host]);

  useEffect(() => {
    if (stage !== "connected") {
      hasQueuedRedirectRef.current = false;
      hasRefreshedAccountOnConnectRef.current = false;
      if (redirectRef.current) {
        clearTimeout(redirectRef.current);
        redirectRef.current = null;
      }
      return;
    }

    if (!hasRefreshedAccountOnConnectRef.current) {
      hasRefreshedAccountOnConnectRef.current = true;
      void loadAccount();
    }

    if (hasQueuedRedirectRef.current) {
      return;
    }

    hasQueuedRedirectRef.current = true;
    redirectRef.current = setTimeout(() => {
      navigateToComplete();
    }, AUTO_REDIRECT_MS);

    return () => {
      if (redirectRef.current) {
        clearTimeout(redirectRef.current);
        redirectRef.current = null;
      }
    };
  }, [stage, loadAccount, navigateToComplete]);

  // Tick once per second while a restart cooldown is active so the button label
  // can show the live countdown. Auto-clears the cooldown when expired.
  useEffect(() => {
    if (!restartCooldownUntil) return;
    const interval = setInterval(() => {
      if (Date.now() >= restartCooldownUntil) {
        setRestartCooldownUntil(null);
      } else {
        setCooldownTick((t) => t + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [restartCooldownUntil]);

  const steps = [
    {
      title: "Generate secure QR",
      detail: "The engine starts a dedicated WhatsApp Web session for this account.",
      active: stage === "starting" || stage === "connecting" || stage === "scan" || stage === "connected",
      done: stage === "scan" || stage === "connecting" || stage === "connected",
    },
    {
      title: "Scan from phone",
      detail: "Use WhatsApp > Linked Devices on the mobile device you want to connect.",
      active: stage === "scan" || stage === "connecting" || stage === "connected",
      done: stage === "connecting" || stage === "connected",
    },
    {
      title: "Wait for sync",
      detail: "We keep the session in connecting until the engine confirms it is send-ready.",
      active: stage === "connecting" || stage === "connected",
      done: stage === "connected",
    },
  ];

  return (
    <WorkspaceShell
      activeNav="channels"
      header={{
        title,
        subtitle,
      }}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Link href="/app/channels" className="hover:text-foreground">
              Channels
            </Link>
            <span>/</span>
            <span className="text-foreground">{contextLabel}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={clsx("inline-flex items-center rounded-full px-3 py-1 text-xs font-medium", stagePill(stage))}>
              {stageLabel(stage)}
            </span>
            <Link
              href={backHref}
              className="inline-flex items-center rounded-lg border border-border/60 bg-[hsl(var(--card))] px-3.5 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted"
            >
              {backLabel}
            </Link>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_360px]">
          <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-[hsl(var(--card))] shadow-sm">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.12),transparent_38%)]" />
            <div className="relative space-y-6 p-6 md:p-8">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Live session state
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-foreground">{stageHeadline(stage)}</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                    {stage === "connected" ? connectedMessage : stageDescription(stage)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-[hsl(var(--background))]/90 px-4 py-3 shadow-sm">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Last engine update</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {formatUpdatedAt(typeof session?.last_update === "number" ? session.last_update : null)}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-[hsl(var(--background))]/85 p-6 shadow-sm">
                {stage === "scan" && qr ? (
                  <div className="flex flex-col items-center gap-5 text-center">
                    <div className="rounded-[28px] border border-border/60 bg-white p-4 shadow-lg shadow-sky-100/50">
                      <Image
                        src={qr}
                        alt="WhatsApp QR"
                        width={292}
                        height={292}
                        className="h-72 w-72"
                        unoptimized
                      />
                    </div>
                    <div className="max-w-md space-y-2">
                      <p className="text-sm font-medium text-foreground">Scan once from the exact phone you want linked.</p>
                      <p className="text-sm text-muted-foreground">
                        Keep this tab open while WhatsApp finishes pairing and syncing. The account will return to the workspace automatically when the engine confirms readiness.
                      </p>
                    </div>
                  </div>
                ) : stage === "connected" ? (
                  <div className="flex flex-col items-center gap-4 py-6 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shadow-sm">
                      <div className="h-6 w-6 rounded-full bg-emerald-600" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-semibold text-foreground">Session confirmed</p>
                      <p className="text-sm text-muted-foreground">{connectedMessage}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-emerald-700">
                        Returning to workspace...
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={navigateToComplete}
                      className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-[hsl(var(--primary-dark))]"
                    >
                      Open account now
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 py-8 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border/60 bg-[hsl(var(--card))] shadow-sm">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                    </div>
                    <div className="max-w-md space-y-2">
                      <p className="text-base font-semibold text-foreground">{stageHeadline(stage)}</p>
                      <p className="text-sm text-muted-foreground">{stageDescription(stage)}</p>
                    </div>
                  </div>
                )}
              </div>

              {(pollError || actionError) && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {pollError || actionError}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {(() => {
                  const cooldownSecondsLeft = restartCooldownUntil
                    ? Math.max(0, Math.ceil((restartCooldownUntil - Date.now()) / 1000))
                    : 0;
                  const inCooldown = cooldownSecondsLeft > 0;
                  const onRestartClick = () => {
                    setRestartCooldownUntil(Date.now() + FORCE_RESTART_COOLDOWN_MS);
                    void startSession(true, true);
                  };
                  const label = isStarting
                    ? "Restarting..."
                    : inCooldown
                    ? `Wait ${cooldownSecondsLeft}s before retry`
                    : stage === "scan"
                    ? "Refresh QR"
                    : "Restart session";
                  return (
                    <button
                      type="button"
                      onClick={onRestartClick}
                      disabled={isStarting || inCooldown}
                      className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-[hsl(var(--primary-dark))] disabled:opacity-60"
                    >
                      {label}
                    </button>
                  );
                })()}
                <Link
                  href={backHref}
                  className="inline-flex items-center rounded-lg border border-border/60 bg-[hsl(var(--card))] px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted"
                >
                  {backLabel}
                </Link>
              </div>
            </div>
          </section>

          <div className="space-y-4">
            <section className="rounded-2xl border border-border/60 bg-[hsl(var(--card))] p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Session overview</h2>
                <span className="text-xs text-muted-foreground">Channel #{channelAccountId}</span>
              </div>
              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Display name</p>
                  <p className="mt-1 font-medium text-foreground">
                    {loadingAccount ? "Loading..." : account?.display_name || detectedPushname || "WhatsApp Channel"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Detected identity</p>
                  <p className="mt-1 font-medium text-foreground">
                    {loadingAccount ? "Loading..." : detectedPhone || detectedPushname || "Waiting for engine..."}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Workspace status</p>
                  <p className="mt-1 font-medium text-foreground">{account?.status || session?.channel_account_status || "pending"}</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border/60 bg-[hsl(var(--card))] p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground">Linking checklist</h2>
              <div className="mt-4 space-y-3">
                {steps.map((step, index) => (
                  <div
                    key={step.title}
                    className={clsx(
                      "rounded-xl border px-4 py-3 transition-colors",
                      step.done
                        ? "border-emerald-200 bg-emerald-50"
                        : step.active
                          ? "border-amber-200 bg-amber-50"
                          : "border-border/60 bg-[hsl(var(--background))]"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={clsx(
                          "mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                          step.done
                            ? "bg-emerald-600 text-white"
                            : step.active
                              ? "bg-amber-500 text-white"
                              : "bg-muted text-muted-foreground"
                        )}
                      >
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{step.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-border/60 bg-[hsl(var(--card))] p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground">Live diagnostics</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Engine status</span>
                  <span className="font-medium text-foreground">{session?.status || "starting"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Raw status</span>
                  <span className="font-medium text-foreground">{session?.raw_status || "n/a"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">QR available</span>
                  <span className="font-medium text-foreground">{qr ? "yes" : "no"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Account status</span>
                  <span className="font-medium text-foreground">
                    {session?.channel_account_status || account?.status || "pending"}
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
