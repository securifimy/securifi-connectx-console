"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { href: "/app/settings/tenant", label: "Workspace" },
    { href: "/app/settings/audit", label: "Audit log" },
  ];

  return (
    <WorkspaceShell
      activeNav="settings"
      header={{
        title: "Settings",
        subtitle: "Manage workspace profile, audit visibility, and security controls.",
      }}
    >
      <div className="space-y-4">
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
