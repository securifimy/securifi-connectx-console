"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function AcceptInviteContent() {
  const search = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = search?.get("token");
    if (token) {
      router.replace(`/invite/${token}`);
    } else {
      router.replace("/login");
    }
  }, [search, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200">
      Redirecting…
    </div>
  );
}

export default function AcceptInviteAlias() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200">Loading…</div>}>
      <AcceptInviteContent />
    </Suspense>
  );
}
