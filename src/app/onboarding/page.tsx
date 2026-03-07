"use client";

import Link from "next/link";
import { useAuthStore } from "@/lib/auth-store";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";

export default function OnboardingPage() {
  const { token, hydrateFromStorage } = useAuthStore();
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    hydrateFromStorage();
    const raf = requestAnimationFrame(() => setHydrated(true));
    return () => cancelAnimationFrame(raf);
  }, [hydrateFromStorage]);

  useEffect(() => {
    if (hydrated && !token) {
      router.replace("/login?redirect=/onboarding");
    }
  }, [hydrated, token, router]);

  if (!hydrated || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        Loading onboarding...
      </div>
    );
  }

  return (
    <WorkspaceShell
      activeNav="channels"
      header={{
        title: "Onboarding",
        subtitle: "Set up your workspace, connect the first channel, and get the team ready to operate.",
      }}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-2xl border border-border/60 bg-[hsl(var(--card))] p-8 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Welcome</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Get the workspace ready</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Follow these steps to move from a fresh workspace to a send-ready channel and an operational team.
            </p>

            <ol className="mt-8 space-y-4 text-sm">
              <li className="flex gap-3 items-start">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">1</span>
                <div>
                  <p className="font-medium text-foreground">Set workspace profile</p>
                  <p className="mt-1 text-muted-foreground">Add the workspace name, logo, and allowed origins in Settings / Workspace.</p>
                </div>
              </li>
              <li className="flex gap-3 items-start">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">2</span>
                <div>
                  <p className="font-medium text-foreground">Add a WhatsApp channel</p>
                  <p className="mt-1 text-muted-foreground">Create a new channel, scan the QR, and wait until the session is healthy before sending.</p>
                </div>
              </li>
              <li className="flex gap-3 items-start">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">3</span>
                <div>
                  <p className="font-medium text-foreground">Invite the team</p>
                  <p className="mt-1 text-muted-foreground">Send invites from Team so agents can join the workspace and start handling conversations.</p>
                </div>
              </li>
            </ol>
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-border/60 bg-[hsl(var(--card))] p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground">Next action</h2>
              <div className="mt-4 flex flex-col gap-3">
                <Link
                  href="/app/channels/new"
                  className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-[hsl(var(--primary-dark))]"
                >
                  Add WhatsApp channel
                </Link>
                <Link
                  href="/app/settings/tenant"
                  className="inline-flex items-center justify-center rounded-lg border border-border/60 bg-[hsl(var(--card))] px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted"
                >
                  Open workspace settings
                </Link>
                <Link
                  href="/app/chat"
                  className="inline-flex items-center justify-center rounded-lg border border-border/60 bg-[hsl(var(--card))] px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted"
                >
                  Go to inbox
                </Link>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </WorkspaceShell>
  );
}
