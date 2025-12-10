"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { apiAcceptInvite } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const tokenParam = params?.token;
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!tokenParam) {
    return <div className="min-h-screen flex items-center justify-center">Invalid invite link.</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiAcceptInvite({
        token: tokenParam,
        name,
        password,
        password_confirmation: passwordConfirmation,
      });
      setAuth(data.token, data.user, data.tenant);
      router.push("/app/chat");
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to accept invite");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4 text-slate-100">
        <h1 className="text-lg font-semibold">Join workspace</h1>
        <p className="text-xs text-slate-400">
          You&apos;ve been invited to a Securifi Connect workspace. Set your account details to continue.
        </p>

        {error && <div className="text-xs text-red-400">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-200">Name</label>
            <input
              type="text"
              required
              className="w-full border border-slate-700 rounded px-3 py-2 text-sm bg-slate-950 text-slate-100"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-200">Password</label>
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
            {loading ? "Joining…" : "Join workspace"}
          </button>
        </form>
      </div>
    </div>
  );
}
