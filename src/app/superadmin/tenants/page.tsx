"use client";

import { useEffect, useState } from "react";
import { apiSuperadminTenants } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

type TenantRow = {
  id: number;
  name: string;
  slug: string;
  plan?: string;
  status?: string;
  users_count?: number;
  channels_count?: number;
  channel_accounts_count?: number;
  messages_count?: number;
  created_at?: string;
};

export default function SuperadminTenantsPage() {
  const token = useAuthStore((s) => s.token);
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await apiSuperadminTenants();
        if (!cancelled) setRows(data || []);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Failed to load tenants");
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
      <h2 className="text-xl font-semibold">Tenants</h2>
      {error && <div className="text-sm text-red-400">{error}</div>}
      <div className="p-4 rounded-lg border border-slate-800 bg-slate-900 text-sm text-slate-100 overflow-auto">
        {loading ? (
          <p className="text-slate-400 text-sm">Loading…</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Slug</th>
                <th className="px-3 py-2 text-left">Plan</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Users</th>
                <th className="px-3 py-2 text-left">Channels</th>
                <th className="px-3 py-2 text-left">Messages</th>
                <th className="px-3 py-2 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b border-slate-800">
                  <td className="px-3 py-2">{t.name}</td>
                  <td className="px-3 py-2 text-slate-400">{t.slug}</td>
                  <td className="px-3 py-2 text-slate-400">{t.plan || "—"}</td>
                  <td className="px-3 py-2">{t.status || "—"}</td>
                  <td className="px-3 py-2">{t.users_count ?? "—"}</td>
                  <td className="px-3 py-2">{t.channels_count ?? "—"}</td>
                  <td className="px-3 py-2">{t.messages_count ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-400">
                    {t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-slate-500" colSpan={8}>
                    No tenants found.
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
