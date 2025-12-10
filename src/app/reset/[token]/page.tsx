"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { apiAuthResetPassword } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>();
  const tokenParam = params?.token;
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!tokenParam) {
    return <div className="min-h-screen flex items-center justify-center">Invalid reset link.</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiAuthResetPassword({
        token: tokenParam,
        password,
        password_confirmation: passwordConfirmation,
      });
      setAuth(data.token, data.user, data.tenant);
      router.push("/app/chat");
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4 text-slate-100">
        <h1 className="text-lg font-semibold">Set a new password</h1>
        <p className="text-xs text-slate-400">Choose a strong password for your Securifi Connect account.</p>

        {error && <div className="text-xs text-red-400">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-200">New password</label>
            <input
              type="password"
              required
              className="w-full border border-slate-700 rounded px-3 py-2 text-sm bg-slate-950 text-slate-100"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-200">Confirm password</label>
            <input
              type="password"
              required
              className="w-full border border-slate-700 rounded px-3 py-2 text-sm bg-slate-950 text-slate-100"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              minLength={8}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
