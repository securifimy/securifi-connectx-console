"use client";

import { useEffect, useState } from "react";
import { apiSuperadminSystemHealth } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

type Health = {
  redis?: string;
  db?: string;
  engine?: string;
  sidekiq_latency?: number;
};

export default function SuperadminSystemHealthPage() {
  const token = useAuthStore((s) => s.token);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await apiSuperadminSystemHealth();
        if (!cancelled) setHealth(data);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Failed to load system health");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const cards = [
    { label: "Redis", value: health?.redis ?? "—" },
    { label: "Database", value: health?.db ?? "—" },
    { label: "Engine", value: health?.engine ?? "—" },
    { label: "Sidekiq latency", value: health?.sidekiq_latency ?? "—" },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">System Health</h2>
      {error && <div className="text-sm text-red-400">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="p-4 rounded-lg border border-slate-800 bg-slate-900">
            <p className="text-xs text-slate-400">{card.label}</p>
            <p className="text-2xl font-semibold text-white">{card.value}</p>
          </div>
        ))}
      </div>
      {loading && <p className="text-sm text-slate-400">Refreshing…</p>}
    </div>
  );
}
