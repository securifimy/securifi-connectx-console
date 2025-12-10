"use client";

import { useAuthStore } from "@/lib/auth-store";
import { useRouter } from "next/navigation";
import { UserProfileMenu } from "./UserProfileMenu";
import { ThemeToggle } from "@/components/theme-toggle";

type TopbarProps = {
  variant?: "tenant" | "superadmin";
};

export function Topbar({ variant = "tenant" }: TopbarProps) {
  const { tenant, user } = useAuthStore();
  const { clearAuth } = useAuthStore();
  const router = useRouter();
  const isTenant = variant === "tenant";
  const planValue =
    ((tenant as Record<string, unknown> | null)?.["plan"] as string | undefined) ||
    ((tenant as Record<string, unknown> | null)?.["current_plan"] as string | undefined) ||
    "Free";
  const name = (user as Record<string, unknown> | null)?.["name"] as string | undefined;
  const email = (user as Record<string, unknown> | null)?.["email"] as string | undefined;

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-border/50 bg-[hsl(var(--card))] dark:bg-[#111418]/95 backdrop-blur shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
        <span className="text-[18px] font-semibold text-foreground">{isTenant ? "Workspace" : "Superadmin"}</span>
        <span className="text-xs text-muted-foreground">{isTenant ? "Inbox & channels" : "Platform overview"}</span>
      </div>
      </div>
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
