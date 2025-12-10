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
      <h2 className="text-xl font-semibold">Webhook Logs</h2>
      {error && <div className="text-sm text-red-400">{error}</div>}
      <div className="p-4 rounded-lg border border-slate-800 bg-slate-900 text-sm text-slate-100 overflow-auto">
        {loading ? (
          <p className="text-slate-400 text-sm">Loading…</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
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
                <tr key={r.id} className="border-b border-slate-800 align-top">
                  <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{r.tenant_name || r.tenant_id || "—"}</td>
                  <td className="px-3 py-2">{r.event || "—"}</td>
                  <td className="px-3 py-2">{r.status || "—"}</td>
                  <td className="px-3 py-2">{r.attempts ?? "—"}</td>
                  <td className="px-3 py-2">{r.response_status ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-400 break-all">{r.error_message || "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-slate-500" colSpan={7}>
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
