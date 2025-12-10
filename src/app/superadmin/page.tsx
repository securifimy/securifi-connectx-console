"use client";

import { useEffect, useState } from "react";
import { apiSuperadminStats } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

type Stats = {
  tenants_count: number;
  users_count: number;
  channels_count: number;
  channel_accounts_count: number;
  messages_last_24h: number;
  api_requests_last_24h: number;
  webhook_deliveries_last_24h: number;
};

export default function SuperadminDashboardPage() {
  const token = useAuthStore((s) => s.token);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiSuperadminStats()
      .then(setStats)
      .catch((e) => {
        console.error(e);
        setError("Failed to load stats");
      });
  }, [token]);

  const cards: { label: string; value: number | string }[] = [
    { label: "Tenants", value: stats?.tenants_count ?? "—" },
    { label: "Users", value: stats?.users_count ?? "—" },
    { label: "Channels", value: stats?.channels_count ?? "—" },
    { label: "Channel Accounts", value: stats?.channel_accounts_count ?? "—" },
    { label: "Messages (24h)", value: stats?.messages_last_24h ?? "—" },
    { label: "API Requests (24h)", value: stats?.api_requests_last_24h ?? "—" },
    { label: "Webhooks (24h)", value: stats?.webhook_deliveries_last_24h ?? "—" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Superadmin Dashboard</h2>
        <p className="text-sm text-slate-300">Platform-level overview.</p>
      </div>
      {error && <div className="text-sm text-red-400">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="p-4 rounded-lg border border-slate-800 bg-slate-900">
            <p className="text-xs text-slate-400">{card.label}</p>
            <p className="text-2xl font-semibold text-white">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
