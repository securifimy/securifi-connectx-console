"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import {
  apiGetChannelAccounts,
  ChannelAccount,
  apiDisconnectChannelAccount,
  apiDeleteChannelAccount,
} from "@/lib/api";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";

function isUnauthorized(error: unknown): error is { status: number } {
  return Boolean(
    error &&
      typeof error === "object" &&
      "status" in error &&
      (error as { status?: number }).status === 401
  );
}

export default function ChannelsPage() {
  const router = useRouter();
  const { token, tenant, clearAuth } = useAuthStore();
  const [accounts, setAccounts] = useState<ChannelAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [actioningId, setActioningId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGetChannelAccounts(token);
      setAccounts(data);
    } catch (err) {
      if (isUnauthorized(err)) {
        setError("Session expired. Please sign in again.");
        clearAuth();
        router.replace("/login");
      } else {
        setError(err instanceof Error ? err.message : "Failed to load accounts");
      }
    } finally {
      setLoading(false);
    }
  }, [token, clearAuth, router]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  async function handleDisconnect(accountId: number) {
    if (!token) return;
    if (!window.confirm("Disconnect this WhatsApp session?")) return;
    setActioningId(accountId);
    try {
      await apiDisconnectChannelAccount(token, accountId);
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect channel");
    } finally {
      setActioningId(null);
    }
  }

  async function handleDelete(accountId: number) {
    if (!token) return;
    if (!window.confirm("Delete this WhatsApp channel? This cannot be undone.")) return;
    setActioningId(accountId);
    try {
      await apiDeleteChannelAccount(token, accountId);
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete channel");
    } finally {
      setActioningId(null);
    }
  }

  const statusPill = (status?: string) => {
    const s = (status || "").toLowerCase();
    if (s === "active") return "bg-emerald-50 text-emerald-700 border border-emerald-100";
    if (s === "pending" || s === "connecting") return "bg-amber-50 text-amber-700 border border-amber-100";
    if (s === "failed" || s === "disconnected" || s === "inactive") return "bg-red-50 text-red-600 border border-red-100";
    return "bg-muted text-foreground border border-border/60";
  };

  return (
    <WorkspaceShell
      activeNav="channels"
      header={{
        title: "Channels",
        subtitle: tenant?.name ? `${tenant.name} connected messaging channels` : "Connected messaging channels",
      }}
    >
      <div className="space-y-6 max-w-screen-xl mx-auto px-2 md:px-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className="text-foreground">Channels</span>
          </div>
          <div className="flex items-center gap-3">
            {loading && <span className="text-[11px] text-muted-foreground">Loading...</span>}
            <Link
              href="/app/channels/new"
              className="inline-flex items-center rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-[hsl(var(--primary-dark))]"
            >
              + Add Channel
            </Link>
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="space-y-3">
          {loading && accounts.length === 0
            ? Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-24 rounded-xl border border-border/60 bg-[hsl(var(--muted))] animate-pulse"
                />
              ))
            : null}

          {!loading && accounts.length === 0 && (
            <div className="text-center rounded-xl border border-border/60 bg-[hsl(var(--card))] p-8">
              <div className="text-[16px] font-medium text-foreground">No channels yet</div>
              <p className="text-[13px] text-muted-foreground mt-1">
                Add a WhatsApp channel to start receiving messages.
              </p>
            </div>
          )}

          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="p-4 bg-[hsl(var(--card))] border border-ui-border/60 rounded-xl flex items-center justify-between shadow-sm hover:shadow-md hover:-translate-y-[1px] transition"
            >
              <div className="space-y-1">
                <p className="text-[15px] font-semibold text-foreground">{acc.display_name || "WhatsApp Channel"}</p>
                <p className="text-[12px] text-muted-foreground">
                  {acc.phone_number || acc.external_identifier || "Unknown"}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className={`inline-flex items-center rounded-full px-3 py-[2px] text-[11px] font-medium ${statusPill(acc.status)}`}>
                    {acc.status ? acc.status.toUpperCase() : "OFFLINE"}
                  </span>
                  <span>Account ID: {acc.id}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {acc.status !== "active" && (
                  <button
                    onClick={() => router.push(`/app/channels/${acc.id}/connect`)}
                    className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground shadow-sm hover:bg-[hsl(var(--primary-dark))] disabled:opacity-60"
                  >
                    {acc.status === "disconnected" ? "Reconnect" : "Connect"}
                  </button>
                )}
                <button
                  onClick={() => router.push(`/app/channels/${acc.id}`)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-ui-border text-foreground hover:bg-muted"
                >
                  Manage
                </button>
                {acc.status === "active" && (
                  <button
                    onClick={() => handleDisconnect(acc.id)}
                    disabled={actioningId === acc.id}
                    className="px-3 py-1.5 text-sm rounded-lg bg-amber-500 text-white hover:bg-amber-400 disabled:opacity-60"
                  >
                    {actioningId === acc.id ? "Disconnecting..." : "Disconnect"}
                  </button>
                )}
                <button
                  onClick={() => handleDelete(acc.id)}
                  disabled={actioningId === acc.id}
                  className="px-3 py-1.5 text-sm rounded-lg bg-red-500 text-white hover:bg-red-400 disabled:opacity-60"
                >
                  {actioningId === acc.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </WorkspaceShell>
  );
}
