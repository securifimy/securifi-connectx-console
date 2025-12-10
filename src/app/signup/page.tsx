"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRegister } from "@/lib/api";

const plans = [
  { code: "free", label: "Free" },
  { code: "pro", label: "Pro" },
];

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("free");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const validate = () => {
    let valid = true;
    const emailRegex = /\S+@\S+\.\S+/;
    if (name.trim().length < 3) {
      setNameError("Workspace name must be at least 3 characters.");
      valid = false;
    } else {
      setNameError(null);
    }
    if (!emailRegex.test(email)) {
      setEmailError("Enter a valid email address.");
      valid = false;
    } else {
      setEmailError(null);
    }
    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setError(null);
    setLoading(true);
    try {
      await apiRegister({ name, email, plan_code: plan });
      setSubmitted(true);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to sign up");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 px-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-3">
          <h1 className="text-xl font-semibold text-white">Check your email</h1>
          <p className="text-sm text-slate-300">
            We sent a verification link to <span className="font-mono">{email}</span>. Click it to finish setting up your workspace.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 px-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Create your workspace</h1>
          <p className="text-sm text-slate-400">Start a free trial—no credit card required.</p>
        </div>

        {error && <div className="text-xs text-red-400">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-slate-300">Workspace name</label>
            <input
              type="text"
              required
              className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Support"
            />
            {nameError && <p className="text-xs text-red-400">{nameError}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-300">Email</label>
            <input
              type="email"
              required
              className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            {emailError && <p className="text-xs text-red-400">{emailError}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-300">Plan</label>
            <div className="grid grid-cols-2 gap-2">
              {plans.map((p) => (
                <button
                  type="button"
                  key={p.code}
                  onClick={() => setPlan(p.code)}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    plan === p.code
                      ? "border-blue-500 bg-blue-500/10 text-white"
                      : "border-slate-700 bg-slate-950 text-slate-300"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? "Submitting…" : "Start free trial"}
          </button>
        </form>

        <p className="text-xs text-slate-500">
          Already have an account?{" "}
          <button
            onClick={() => router.push("/login")}
            className="text-blue-400 hover:text-blue-300"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
