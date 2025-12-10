"use client";

import { useAuthStore } from "@/lib/auth-store";
import { SuperadminShell } from "@/components/layout/SuperadminShell";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { token, user, hydrateFromStorage } = useAuthStore();

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  useEffect(() => {
    if (!token) {
      const redirectTo = pathname || "/superadmin";
      router.replace(`/login?redirect=${encodeURIComponent(redirectTo)}`);
    }
  }, [token, router, pathname]);

  const userObj = (user || {}) as Record<string, unknown>;
  const isSuperadmin = Boolean(userObj["is_superadmin"] || userObj["superadmin"]);

  if (!token) return null;
  if (!isSuperadmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ui-bg text-ui-text">
        <div className="p-6 rounded-xl border border-ui-border bg-ui-panel">
          <p className="text-sm">You do not have access to the superadmin console.</p>
        </div>
      </div>
    );
  }

  return <SuperadminShell>{children}</SuperadminShell>;
}
