"use client";

import { useAuthStore } from "@/lib/auth-store";
import { useRouter } from "next/navigation";
import { UserProfileMenu } from "./UserProfileMenu";
import { ThemeToggle } from "@/components/theme-toggle";

type TopbarProps = {
  variant?: "tenant" | "superadmin";
  title?: string;
  subtitle?: string;
};

export function Topbar({
  variant = "tenant",
  title,
  subtitle,
}: TopbarProps) {
  const { tenant, user } = useAuthStore();
  const { clearAuth } = useAuthStore();
  const router = useRouter();
  const isTenant = variant === "tenant";
  const hasPageHeader = Boolean(title || subtitle);
  const planValue =
    ((tenant as Record<string, unknown> | null)?.["plan"] as string | undefined) ||
    ((tenant as Record<string, unknown> | null)?.["current_plan"] as string | undefined) ||
    "Free";
  const name = (user as Record<string, unknown> | null)?.["name"] as string | undefined;
  const email = (user as Record<string, unknown> | null)?.["email"] as string | undefined;

  if (!hasPageHeader) {
    return (
      <header className="h-16 flex items-center justify-between px-6 border-b border-border/50 bg-[hsl(var(--card))] dark:bg-[#111418]/95 backdrop-blur shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <UserProfileMenu
            user={{
              name,
              email,
            }}
            plan={isTenant ? planValue : undefined}
            onLogout={() => {
              clearAuth();
              router.push("/login");
            }}
          />
        </div>
      </header>
    );
  }

  return (
    <header className="h-16 border-b border-border/50 bg-[hsl(var(--card))] dark:bg-[#111418]/95 px-6 backdrop-blur shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex h-full items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          {title && <h1 className="truncate text-[18px] font-semibold leading-tight text-foreground">{title}</h1>}
          {subtitle && <p className="mt-0.5 truncate text-[12px] leading-tight text-muted-foreground">{subtitle}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-3 sm:justify-end">
          <ThemeToggle />
          <UserProfileMenu
            user={{
              name,
              email,
            }}
            plan={isTenant ? planValue : undefined}
            onLogout={() => {
              clearAuth();
              router.push("/login");
            }}
          />
        </div>
      </div>
    </header>
  );
}
