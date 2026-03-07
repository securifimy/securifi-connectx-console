"use client";

import { useAuthStore } from "@/lib/auth-store";
import { apiCreateInvite, apiGetMe } from "@/lib/api";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";

const roles = ["owner", "admin", "agent", "viewer"];

export default function InviteTeamMemberPage() {
  const token = useAuthStore((s) => s.token);
  const router = useRouter();
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("agent");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shellHeader = {
    title: "Invite Member",
    subtitle: "Send a workspace invitation and assign the access level before the member joins.",
  };

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
      router.push("/app/team");
    } catch (e: unknown) {
      console.error(e);
      setError("Failed to create invite");
    } finally {
      setSaving(false);
    }
  };

  if (!token) {
    return (
      <WorkspaceShell activeNav="team" header={shellHeader}>
        <div className="text-sm text-red-500">Not authenticated.</div>
      </WorkspaceShell>
    );
  }

  if (loading) {
    return (
      <WorkspaceShell activeNav="team" header={shellHeader}>
        <div className="text-sm text-[var(--text2)]">Loading…</div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell activeNav="team" header={shellHeader}>
      <div className="max-w-md space-y-4">
        {error && <div className="text-xs text-red-500">{error}</div>}

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm"
        >
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
              onClick={() => router.push("/app/team")}
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
    </WorkspaceShell>
  );
}
