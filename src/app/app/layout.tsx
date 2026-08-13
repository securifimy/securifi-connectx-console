"use client";

import { useAuthStore } from "@/lib/auth-store";
import { RequireReaderKey } from "@/components/crypto/RequireReaderKey";
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
    if (typeof document === "undefined") return;
    document.body.classList.add("app-shell");
    return () => {
      document.body.classList.remove("app-shell");
    };
  }, []);

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
  //
  // Everything inside the workspace sits behind the key check, so a user who
  // has not enrolled — including one who registered a minute ago — sets one up
  // before reaching the inbox, rather than after messages have already been
  // refused on their behalf.
  return (
    <RequireReaderKey token={token}>
      <div className="h-full min-h-0 bg-[var(--bg)] text-[var(--text)]">{children}</div>
    </RequireReaderKey>
  );
}
