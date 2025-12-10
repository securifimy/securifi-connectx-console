"use client";

import Link from "next/link";
import { useAuthStore } from "@/lib/auth-store";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
        Loading onboarding…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6 shadow-xl">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Welcome</p>
          <h1 className="text-2xl font-semibold text-white mt-1">Let&apos;s get your workspace ready</h1>
          <p className="text-sm text-slate-400 mt-2">
            Follow these quick steps to start chatting from your WhatsApp channel.
          </p>
        </div>

        <ol className="space-y-3 text-sm">
          <li className="flex gap-3 items-start">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold">1</span>
            <div>
              <p className="font-medium text-white">Set workspace profile</p>
              <p className="text-slate-400">Add your workspace name, logo, and allowed origins in Settings → Workspace.</p>
            </div>
          </li>
          <li className="flex gap-3 items-start">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold">2</span>
            <div>
              <p className="font-medium text-white">Connect WhatsApp</p>
              <p className="text-slate-400">Create a new WhatsApp channel and scan the QR to link your phone.</p>
            </div>
          </li>
          <li className="flex gap-3 items-start">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold">3</span>
            <div>
              <p className="font-medium text-white">Invite your team</p>
              <p className="text-slate-400">Send invites from Settings → Users so agents can join.</p>
            </div>
          </li>
        </ol>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/app/channels/new"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Connect WhatsApp
          </Link>
          <Link
            href="/app/settings/tenant"
            className="inline-flex items-center rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500"
          >
            Open Settings
          </Link>
          <Link
            href="/app/chat"
            className="inline-flex items-center rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500"
          >
            Skip for now
          </Link>
        </div>
      </div>
    </div>
  );
}
