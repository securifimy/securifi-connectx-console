"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { apiGetAuditLogs, apiGetMe, AuditLogEntry } from "@/lib/api";

const EVENT_LABELS: Record<string, string> = {
  login_success: "Login success",
  login_failure: "Login failure",
  user_invited: "User invited",
  membership_updated: "Membership updated",
  membership_disabled: "Membership disabled",
  tenant_updated: "Workspace updated",
  password_reset_requested: "Password reset requested",
  password_reset_completed: "Password reset completed",
  api_key_created: "API key created",
  api_key_disabled: "API key disabled",
  webhook_replayed: "Webhook replayed",
};

export default function AuditLogPage() {
  const token = useAuthStore((s) => s.token);
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const authToken = token;

    async function load() {
      try {
        setLoading(true);
        const me = await apiGetMe(authToken);
        if (cancelled) return;

        if (!["owner", "admin"].includes(me.membership.role)) {
          setError("You do not have permission to view audit logs.");
          setEntries([]);
          return;
        }

        const data = await apiGetAuditLogs(authToken, { limit: 100 });
        if (!cancelled) setEntries(data);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Failed to load audit log.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) return <div className="text-sm text-red-500">Not authenticated.</div>;
  if (loading) return <div className="text-sm text-[var(--text2)]">Loading audit log…</div>;
  if (error) return <div className="text-sm text-red-500">{error}</div>;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-[var(--text)]">Audit log</h2>
        <p className="text-xs text-[var(--text2)]">Recent security-sensitive events (last 100 entries).</p>
      </div>

      <div className="border border-[var(--border)] rounded-lg overflow-hidden max-h-[480px] overflow-y-auto bg-[var(--surface2)]">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--surface)] text-xs uppercase text-[var(--text2)]">
            <tr>
              <th className="px-3 py-2 text-left">Time</th>
              <th className="px-3 py-2 text-left">Event</th>
              <th className="px-3 py-2 text-left">Actor</th>
              <th className="px-3 py-2 text-left">Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {entries.map((e) => (
              <tr key={e.id} className="align-top">
                <td className="px-3 py-2 text-xs text-[var(--text2)] whitespace-nowrap">
                  {new Date(e.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-xs text-[var(--text)]">
                  {EVENT_LABELS[e.action] || e.action}
                </td>
                <td className="px-3 py-2 text-xs text-[var(--text)]">
                  {e.actor_id ? `${e.actor_type || "user"} #${e.actor_id}` : "System"}
                </td>
                <td className="px-3 py-2 text-xs font-mono text-[var(--text2)] break-all">
                  {JSON.stringify(e.metadata || {})}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-xs text-[var(--text2)]" colSpan={4}>
                  No audit events yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
