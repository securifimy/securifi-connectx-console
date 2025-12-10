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
    if (!window.confirm("Delete this channel? This cannot be undone.")) return;
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

  return (
    <WorkspaceShell activeNav="channels">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[20px] font-semibold text-[var(--text)]">Channels</h2>
            <p className="text-sm text-[var(--text2)]">
              {tenant?.name ? `${tenant.name} WhatsApp accounts` : "WhatsApp accounts"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {loading && <span className="text-[11px] text-[var(--text2)]">Loading...</span>}
            <Link
              href="/app/channels/new"
            className="inline-flex items-center rounded-lg bg-brand-blue px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90"
            >
              + New WhatsApp Channel
            </Link>
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="space-y-3">
          {accounts.length === 0 && !loading ? (
            <p className="text-sm text-[var(--text2)]">No channel accounts configured yet.</p>
          ) : (
            accounts.map((acc) => (
              <div
                key={acc.id}
                className="p-4 bg-white border border-ui-border/70 rounded-xl flex items-center justify-between shadow-sm"
              >
                <div>
                  <p className="font-semibold text-[var(--text)]">{acc.display_name || "WhatsApp Account"}</p>
                  <p className="text-sm text-[var(--text2)]">
                    {acc.phone_number || acc.external_identifier || "Unknown"}
                  </p>
                  <p className="text-xs text-[var(--text2)] mt-1">Status: {acc.status || "offline"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {acc.status !== "active" && (
                    <button
                      onClick={() => router.push(`/app/channels/${acc.id}/connect`)}
                      className="px-3 py-1.5 text-sm rounded-lg bg-brand-blue text-white shadow-sm hover:opacity-90 disabled:opacity-60"
                    >
                      Connect
                    </button>
                  )}
                  <button
                    onClick={() => router.push(`/app/channels/${acc.id}`)}
                    className="px-3 py-1.5 text-sm rounded-lg border border-ui-border text-[var(--text)] hover:bg-[var(--surface2)]"
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
            ))
          )}
        </div>
      </div>
    </WorkspaceShell>
  );
}
