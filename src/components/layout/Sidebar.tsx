"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Mail, Link2, Users, Settings, CreditCard, LayoutDashboard, Activity, Server, ShieldCheck } from "lucide-react";
import { useSidebarStore } from "@/lib/store/useSidebarStore";
import { SidebarToggleMinimal } from "./SidebarToggleMinimal";

type SidebarProps = {
  variant?: "tenant" | "superadmin";
  activeNav?: string;
};

const tenantNav = [
  { id: "inbox", href: "/app/chat", label: "Inbox", icon: Mail },
  { id: "channels", href: "/app/channels", label: "Channels", icon: Link2 },
  { id: "team", href: "/app/team", label: "Team Members", icon: Users },
  { id: "settings", href: "/app/settings", label: "Workspace Settings", icon: Settings },
  { id: "billing", href: "/app/billing", label: "Billing & Usage", icon: CreditCard },
];

const superadminNav = [
  { id: "dashboard", href: "/superadmin", label: "Dashboard", icon: LayoutDashboard },
  { id: "tenants", href: "/superadmin/tenants", label: "Tenants", icon: Users },
  { id: "api-logs", href: "/superadmin/api-logs", label: "API Logs", icon: Activity },
  { id: "webhooks", href: "/superadmin/webhook-logs", label: "Webhooks", icon: Link2 },
  { id: "audit", href: "/superadmin/audit", label: "Audit", icon: ShieldCheck },
  { id: "system", href: "/superadmin/system-health", label: "System", icon: Server },
];

export default function Sidebar({ variant = "tenant", activeNav }: SidebarProps) {
  const pathname = usePathname();
  const { theme } = useTheme();
  const { isCollapsed, toggle } = useSidebarStore();
  const isTenant = variant === "tenant";
  const items = isTenant ? tenantNav : superadminNav;
  const logoSrc = isCollapsed
    ? theme === "light"
      ? "/logo-icon-light.svg"
      : "/logo-icon-dark.svg"
    : theme === "light"
      ? "/logo.png"
      : "/logo-connectx-dark.svg";

  return (
    <aside
      className={[
        "hidden md:flex md:flex-col relative bg-[hsl(var(--card))] dark:bg-ui-sidebarDark border-r border-border/60 transition-all duration-300",
        isCollapsed ? "w-20" : "w-64",
      ].join(" ")}
    >
      <div className="h-16 px-6 flex items-center border-b border-border/60">
        <Link href={isTenant ? "/app/chat" : "/superadmin"} className="flex items-center gap-2">
          <Image
            src={logoSrc}
            alt="Securifi ConnectX"
            width={isCollapsed ? 32 : 160}
            height={40}
            className={isCollapsed ? "object-contain h-8 w-8" : "object-contain max-h-8 w-auto"}
            priority
          />
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const isRootMatch = pathname === item.href;
          const isChildMatch = pathname.startsWith(item.href + "/");
          const active = activeNav
            ? activeNav === item.id
            : item.href === "/superadmin"
              ? isRootMatch
              : isRootMatch || isChildMatch;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "group relative flex items-center gap-3 rounded-md px-3 h-11 text-sm transition-colors border-l-2",
                active
                  ? "border-primary bg-primary/10 text-primary font-semibold"
                  : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                isCollapsed ? "justify-center px-2" : "",
              ].join(" ")}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
              <span
                className={[
                  "truncate transition-opacity duration-200",
                  isCollapsed ? "opacity-0" : "opacity-100",
                ].join(" ")}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-4 pb-4">
        <SidebarToggleMinimal collapsed={isCollapsed} onToggle={toggle} />
      </div>
    </aside>
  );
}
