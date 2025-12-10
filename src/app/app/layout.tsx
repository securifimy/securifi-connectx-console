"use client";

import { useAuthStore } from "@/lib/auth-store";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, hydrateFromStorage } = useAuthStore();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    hydrateFromStorage();
    const raf = requestAnimationFrame(() => setHydrated(true));
    return () => cancelAnimationFrame(raf);
  }, [hydrateFromStorage]);

  useEffect(() => {
    if (hydrated && !token) {
      router.replace("/login");
    }
  }, [hydrated, token, router]);

  if (!hydrated || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ui-bg text-ui-textMuted">
        Loading workspace…
      </div>
    );
  }

  // Default shell; pages will wrap with WorkspaceShell to set activeNav.
  return <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">{children}</div>;
}
