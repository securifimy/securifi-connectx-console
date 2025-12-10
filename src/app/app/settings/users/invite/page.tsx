"use client";

import { useAuthStore } from "@/lib/auth-store";
import { apiCreateInvite, apiGetMe } from "@/lib/api";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const roles = ["owner", "admin", "agent", "viewer"];

export default function InviteUserPage() {
  const token = useAuthStore((s) => s.token);
  const router = useRouter();
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("agent");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const authToken = token;

    async function load() {
      try {
        const me = await apiGetMe(authToken);
        if (!cancelled) {
          setTenantId(me.tenant.id);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Failed to load tenant.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !tenantId) return;
    setError(null);
    setSaving(true);
    try {
      await apiCreateInvite(token, tenantId, { email, role });
      router.push("/app/settings/users");
    } catch (e: unknown) {
      console.error(e);
      setError("Failed to create invite");
    } finally {
      setSaving(false);
    }
  };

  if (!token) return <div className="text-sm text-red-500">Not authenticated.</div>;
  if (loading) return <div className="text-sm text-[var(--text2)]">Loading…</div>;

  return (
    <div className="max-w-md space-y-4">
      <div>
        <h2 className="text-base font-semibold text-[var(--text)]">Invite user</h2>
        <p className="text-xs text-[var(--text2)]">
          Send an invite for a new member to join this workspace.
        </p>
      </div>

      {error && <div className="text-xs text-red-500">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-[var(--text2)]">Email</label>
          <input
            type="email"
            required
            className="w-full border border-[var(--border)] rounded px-3 py-2 text-sm bg-white text-[var(--text)]"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-[var(--text2)]">Role</label>
          <select
            className="w-full border border-[var(--border)] rounded px-3 py-2 text-sm bg-white text-[var(--text)]"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => router.push("/app/settings/users")}
            className="text-xs text-[var(--text2)] hover:underline"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center rounded-lg bg-brand-blue px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Sending…" : "Send invite"}
          </button>
        </div>
      </form>
    </div>
  );
}
