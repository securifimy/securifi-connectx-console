"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { href: "/app/settings/users", label: "Users" },
    { href: "/app/settings/tenant", label: "Workspace" },
    { href: "/app/settings/audit", label: "Audit log" },
  ];

  return (
    <WorkspaceShell activeNav="settings">
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <div>
            <h1 className="text-[20px] font-semibold text-[var(--text)]">Settings</h1>
            <p className="text-sm text-[var(--text2)]">Manage workspace access, profile, and security.</p>
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const active = pathname?.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={[
                  "rounded-lg px-3 py-2 text-sm border transition-colors whitespace-nowrap",
                  active
                    ? "border-brand-blue bg-brand-blue/10 text-brand-blue font-semibold"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--text2)] hover:text-[var(--text)] hover:border-brand-blue/60",
                ].join(" ")}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        {children}
      </div>
    </WorkspaceShell>
  );
}
