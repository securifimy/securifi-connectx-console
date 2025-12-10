"use client";

import { useEffect, useState } from "react";
import { apiSuperadminAuditLogs } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

type Audit = {
  id: number;
  tenant_id?: number;
  tenant_name?: string;
  action: string;
  actor_type?: string;
  actor_id?: number;
  resource_type?: string;
  resource_id?: number;
  metadata?: Record<string, unknown>;
  created_at: string;
};

export default function SuperadminAuditPage() {
  const token = useAuthStore((s) => s.token);
  const [rows, setRows] = useState<Audit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await apiSuperadminAuditLogs();
        if (!cancelled) setRows(data || []);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Failed to load audit logs");
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
      <h2 className="text-xl font-semibold">Audit Logs</h2>
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
                <th className="px-3 py-2 text-left">Action</th>
                <th className="px-3 py-2 text-left">Actor</th>
                <th className="px-3 py-2 text-left">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-800 align-top">
                  <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{r.tenant_name || r.tenant_id || "—"}</td>
                  <td className="px-3 py-2">{r.action}</td>
                  <td className="px-3 py-2 text-slate-300">{r.actor_type ? `${r.actor_type} #${r.actor_id || ""}` : "System"}</td>
                  <td className="px-3 py-2 text-slate-400 break-all">{JSON.stringify(r.metadata || {})}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-slate-500" colSpan={5}>
                    No audit events yet.
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
