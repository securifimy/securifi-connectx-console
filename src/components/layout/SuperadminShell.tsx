"use client";

import Sidebar from "./Sidebar";
import { Topbar } from "./Topbar";
import { usePathname } from "next/navigation";

type SuperadminHeader = {
  title: string;
  subtitle: string;
};

function resolveSuperadminHeader(pathname: string): SuperadminHeader {
  if (pathname === "/superadmin") {
    return {
      title: "Platform Dashboard",
      subtitle: "Cross-tenant activity, account growth, and message volume across the full platform.",
    };
  }

  if (pathname.startsWith("/superadmin/tenants")) {
    return {
      title: "Tenants",
      subtitle: "Review tenant footprint, plan mix, and usage signals across the platform.",
    };
  }

  if (pathname.startsWith("/superadmin/api-logs")) {
    return {
      title: "API Logs",
      subtitle: "Inspect recent authenticated API traffic across all tenants and channel integrations.",
    };
  }

  if (pathname.startsWith("/superadmin/webhook-logs")) {
    return {
      title: "Webhook Logs",
      subtitle: "Track outbound webhook deliveries, response codes, and retry outcomes platform-wide.",
    };
  }

  if (pathname.startsWith("/superadmin/audit")) {
    return {
      title: "Audit Logs",
      subtitle: "Review security-sensitive admin and tenant events across the platform.",
    };
  }

  if (pathname.startsWith("/superadmin/system-health")) {
    return {
      title: "System Health",
      subtitle: "Monitor platform dependencies, engine availability, and queue latency in one place.",
    };
  }

  return {
    title: "Superadmin",
    subtitle: "Platform-wide operations, diagnostics, and governance controls.",
  };
}

export function SuperadminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const header = resolveSuperadminHeader(pathname || "/superadmin");

  return (
    <div className="h-full min-h-0 w-full bg-ui-bg text-ui-text flex">
      <Sidebar variant="superadmin" />
      <div className="flex-1 flex flex-col min-h-0">
        <Topbar variant="superadmin" title={header.title} subtitle={header.subtitle} />
        <main className="flex-1 min-h-0 bg-ui-bg overflow-hidden">
          <div className="max-w-screen-xl mx-auto w-full h-full min-h-0 px-6 py-10 space-y-6 overflow-y-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
