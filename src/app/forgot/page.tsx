"use client";

import { useState } from "react";
import { apiAuthForgotPassword } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiAuthForgotPassword(email);
      setSubmitted(true);
    } catch (e) {
      console.error(e);
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-3 text-slate-100">
          <h1 className="text-lg font-semibold">Check your email</h1>
          <p className="text-sm text-slate-300">
            If an account exists for <span className="font-mono">{email}</span>, we&apos;ve sent a password reset link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4 text-slate-100">
        <h1 className="text-lg font-semibold">Reset your password</h1>
        <p className="text-xs text-slate-400">Enter the email associated with your Securifi Connect account.</p>

        {error && <div className="text-xs text-red-400">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-200">Email</label>
            <input
              type="email"
              required
              className="w-full border border-slate-700 rounded px-3 py-2 text-sm bg-slate-950 text-slate-100"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>
      </div>
    </div>
  );
}
