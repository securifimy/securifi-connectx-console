"use client";

import { useEffect, useState } from "react";
import { apiSuperadminApiLogs } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

type ApiLog = {
  id: number;
  tenant_id?: number | null;
  tenant_name?: string | null;
  channel_api_key_id?: number | null;
  endpoint: string;
  http_method: string;
  status: number;
  duration_ms?: number;
  created_at: string;
};

export default function SuperadminApiLogsPage() {
  const token = useAuthStore((s) => s.token);
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await apiSuperadminApiLogs();
        if (!cancelled) setLogs(data || []);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Failed to load API logs");
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
                <th className="px-3 py-2 text-left">Method</th>
                <th className="px-3 py-2 text-left">Endpoint</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Duration</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-border/60 align-top">
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {new Date(l.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{l.tenant_name || l.tenant_id || "—"}</td>
                  <td className="px-3 py-2">{l.http_method}</td>
                  <td className="px-3 py-2 break-all text-foreground">{l.endpoint}</td>
                  <td className="px-3 py-2">{l.status}</td>
                  <td className="px-3 py-2 text-muted-foreground">{l.duration_ms ? `${Math.round(l.duration_ms)}ms` : "—"}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-muted-foreground" colSpan={6}>
                    No API logs yet.
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
