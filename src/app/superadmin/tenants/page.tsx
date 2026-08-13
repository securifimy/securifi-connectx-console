"use client";

import { useEffect, useState } from "react";
import { apiSuperadminTenants, apiSuperadminUpdateTenant } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { PLAN_OPTIONS, formatPlanLabel, normalizePlanCode } from "@/lib/plans";

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
  const [planDrafts, setPlanDrafts] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingTenantId, setSavingTenantId] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await apiSuperadminTenants();
        if (!cancelled) {
          const nextRows = data || [];
          setRows(nextRows);
          setPlanDrafts(
            Object.fromEntries(
              nextRows.map((tenant: TenantRow) => [tenant.id, normalizePlanCode(tenant.plan)])
            )
          );
        }
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

  async function savePlan(row: TenantRow) {
    const nextPlan = planDrafts[row.id] || normalizePlanCode(row.plan);
    setSavingTenantId(row.id);
    setError(null);

    try {
      const updated = await apiSuperadminUpdateTenant(row.id, { plan: nextPlan });
      setRows((current) => current.map((tenant) => (tenant.id === row.id ? { ...tenant, ...updated } : tenant)));
      setPlanDrafts((current) => ({ ...current, [row.id]: normalizePlanCode(updated.plan || nextPlan) }));
    } catch (e) {
      console.error(e);
      setError(`Failed to update plan for ${row.name}`);
    } finally {
      setSavingTenantId(null);
    }
  }

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
                <tr key={t.id} className="border-b border-border/60">
                  <td className="px-3 py-2">{t.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{t.slug}</td>
                  <td className="px-3 py-2">
                    <div className="flex min-w-[220px] items-center gap-2">
                      <select
                        className="h-9 rounded-md border border-border/60 bg-background px-3 text-sm text-foreground"
                        value={planDrafts[t.id] || normalizePlanCode(t.plan)}
                        onChange={(event) =>
                          setPlanDrafts((current) => ({
                            ...current,
                            [t.id]: event.target.value,
                          }))
                        }
                      >
                        {PLAN_OPTIONS.map((option) => (
                          <option key={option.code} value={option.code}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="inline-flex h-9 items-center rounded-md border border-border/60 px-3 text-xs font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={
                          savingTenantId === t.id ||
                          (planDrafts[t.id] || normalizePlanCode(t.plan)) === normalizePlanCode(t.plan)
                        }
                        onClick={() => savePlan(t)}
                      >
                        {savingTenantId === t.id ? "Saving..." : "Save"}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Current: {formatPlanLabel(t.plan)}
                    </p>
                  </td>
                  <td className="px-3 py-2">{t.status || "—"}</td>
                  <td className="px-3 py-2">{t.users_count ?? "—"}</td>
                  <td className="px-3 py-2">{t.channels_count ?? "—"}</td>
                  <td className="px-3 py-2">{t.messages_count ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-muted-foreground" colSpan={8}>
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
