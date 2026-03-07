"use client";

import { useEffect, useState } from "react";
import { apiSuperadminWebhookLogs } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

type Delivery = {
  id: number;
  tenant_id?: number;
  tenant_name?: string;
  channel_account_id?: number;
  event?: string;
  status?: string;
  attempts?: number;
  response_status?: number;
  error_message?: string | null;
  created_at: string;
};

export default function SuperadminWebhookLogsPage() {
  const token = useAuthStore((s) => s.token);
  const [rows, setRows] = useState<Delivery[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await apiSuperadminWebhookLogs();
        if (!cancelled) setRows(data || []);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Failed to load webhook logs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="space-y-4">
      {error && <div className="text-sm text-red-500">{error}</div>}
      <div className="p-4 rounded-lg border border-border/60 bg-[hsl(var(--card))] text-sm text-foreground overflow-auto shadow-sm ring-1 ring-border/40">
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border/60">
              <tr>
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">Tenant</th>
                <th className="px-3 py-2 text-left">Event</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Attempts</th>
                <th className="px-3 py-2 text-left">Response</th>
                <th className="px-3 py-2 text-left">Error</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 align-top">
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{r.tenant_name || r.tenant_id || "—"}</td>
                  <td className="px-3 py-2">{r.event || "—"}</td>
                  <td className="px-3 py-2">{r.status || "—"}</td>
                  <td className="px-3 py-2">{r.attempts ?? "—"}</td>
                  <td className="px-3 py-2">{r.response_status ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground break-all">{r.error_message || "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-muted-foreground" colSpan={7}>
                    No webhook deliveries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
