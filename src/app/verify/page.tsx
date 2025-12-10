"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiVerifySignup } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = searchParams?.get("token");
    setToken(t);
  }, [searchParams]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200">
        Invalid or missing token.
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiVerifySignup({ token, password });
      setAuth(data.token, data.user, data.tenant);
      router.replace("/onboarding");
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 px-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Set your password</h1>
          <p className="text-sm text-slate-400">
            Secure your account to finish activating your workspace.
          </p>
        </div>

        {error && <div className="text-xs text-red-400">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-300">New password</label>
            <input
              type="password"
              required
              minLength={8}
              className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-300">Confirm password</label>
            <input
              type="password"
              required
              minLength={8}
              className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          {password && confirm && password !== confirm && (
            <p className="text-xs text-red-400">Passwords do not match.</p>
          )}

          <button
            type="submit"
            disabled={loading || password !== confirm}
            className="w-full py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? "Activating…" : "Activate workspace"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200">Loading…</div>}>
      <VerifyContent />
    </Suspense>
  );
}
