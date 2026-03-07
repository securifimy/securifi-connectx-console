"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { apiGetBillingSummary, apiGetInvoices } from "@/lib/api";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";

type BillingSummary = {
  plan: string;
  monthly_quota_messages: number | null;
  monthly_quota_api_calls: number | null;
  monthly_quota_channels: number | null;
  hard_limit: boolean;
  soft_limit: boolean;
  usage: {
    messages: number;
    api_calls: number;
  };
};

type Invoice = {
  id: number;
  month: string;
  total_messages: number;
  total_api_calls: number;
  amount_due_cents: number;
  status: string;
  generated_at?: string;
};

export default function BillingPage() {
  const { token } = useAuthStore();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setTimeout(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
    }, 0);
    Promise.all([apiGetBillingSummary(token), apiGetInvoices(token)])
      .then(([sum, inv]) => {
        if (cancelled) return;
        setSummary(sum);
        setInvoices(inv);
      })
      .catch((err) => {
        console.error("Billing load failed", err);
        if (!cancelled) setError("Failed to load billing data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <WorkspaceShell
      activeNav="billing"
      header={{
        title: "Billing",
        subtitle: "Review plan limits, monthly usage, and invoice history for this workspace.",
      }}
    >
      <div className="space-y-6">
        {error && <p className="text-sm text-red-500">{error}</p>}
        {loading && <p className="text-sm text-[var(--text2)]">Loading…</p>}

        {summary && (
          <section className="rounded-xl border border-ui-border bg-white p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text2)]">Current plan</p>
                <p className="text-lg font-semibold text-[var(--text)] uppercase">{summary.plan}</p>
              </div>
              <div className="text-xs text-[var(--text2)]">
                Hard limit: {summary.hard_limit ? "On" : "Off"} · Soft limit: {summary.soft_limit ? "On" : "Off"}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-[var(--text)]">
              <QuotaCard label="Messages" used={summary.usage.messages} total={summary.monthly_quota_messages} />
              <QuotaCard label="API Calls" used={summary.usage.api_calls} total={summary.monthly_quota_api_calls} />
              <QuotaCard label="Channels" used={summary.monthly_quota_channels ?? 0} total={summary.monthly_quota_channels} />
            </div>
          </section>
        )}

        <section className="rounded-xl border border-ui-border bg-white p-4 space-y-3 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--text)]">Invoices (last 12 months)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-ui-border text-[var(--text2)]">
                  <th className="py-2">Month</th>
                  <th>Messages</th>
                  <th>API Calls</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-ui-border text-[var(--text)]">
                    <td className="py-2">{inv.month}</td>
                    <td>{inv.total_messages?.toLocaleString() ?? 0}</td>
                    <td>{inv.total_api_calls?.toLocaleString() ?? 0}</td>
                    <td>RM {((inv.amount_due_cents || 0) / 100).toFixed(2)}</td>
                    <td className="uppercase text-xs text-[var(--text2)]">{inv.status}</td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-3 text-center text-[var(--text2)]">
                      No invoices yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}

function QuotaCard({ label, used, total }: { label: string; used: number; total: number | null }) {
  const remaining = total == null ? "unlimited" : Math.max(total - used, 0).toLocaleString();
  const totalText = total == null ? "∞" : total.toLocaleString();
  return (
    <div className="rounded border border-ui-border bg-[var(--surface2)] px-3 py-2">
      <p className="text-[var(--text2)] text-xs">{label}</p>
      <p className="text-[var(--text)] font-semibold">{used.toLocaleString()} / {totalText}</p>
      <p className="text-[var(--text2)] text-xs">Remaining: {remaining}</p>
    </div>
  );
}
