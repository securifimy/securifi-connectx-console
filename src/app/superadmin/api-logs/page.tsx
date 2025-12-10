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
      <h2 className="text-xl font-semibold">API Logs</h2>
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
                <th className="px-3 py-2 text-left">Method</th>
                <th className="px-3 py-2 text-left">Endpoint</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Duration</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-slate-800 align-top">
                  <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                    {new Date(l.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{l.tenant_name || l.tenant_id || "—"}</td>
                  <td className="px-3 py-2">{l.http_method}</td>
                  <td className="px-3 py-2 break-all text-slate-200">{l.endpoint}</td>
                  <td className="px-3 py-2">{l.status}</td>
                  <td className="px-3 py-2 text-slate-400">{l.duration_ms ? `${Math.round(l.duration_ms)}ms` : "—"}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-slate-500" colSpan={6}>
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
