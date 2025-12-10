"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import {
  apiDisableMembership,
  apiGetMe,
  apiGetMembers,
  apiUpdateMembership,
  Membership,
} from "@/lib/api";

export default function UsersSettingsPage() {
  const token = useAuthStore((s) => s.token);
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [membershipRole, setMembershipRole] = useState<string | null>(null);
  const [members, setMembers] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
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
        setLoading(true);
        const me = await apiGetMe(authToken);
        if (cancelled) return;
        setTenantId(me.tenant.id);
        setMembershipRole(me.membership.role);

        const list = await apiGetMembers(authToken, me.tenant.id);
        if (cancelled) return;
        setMembers(list);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Failed to load users");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const canManage = membershipRole === "owner" || membershipRole === "admin";

  const handleRoleChange = async (m: Membership, role: string) => {
    if (!token || !tenantId) return;
    setSavingId(m.id);
    try {
      const updated = await apiUpdateMembership(token, tenantId, m.id, {
        role: role as Membership["role"],
      });
      setMembers((prev) => prev.map((mm) => (mm.id === m.id ? updated : mm)));
    } catch (e) {
      console.error(e);
      setError("Failed to update role");
    } finally {
      setSavingId(null);
    }
  };

  const handleDisable = async (m: Membership) => {
    if (!token || !tenantId) return;
    if (!confirm(`Disable ${m.user.email}?`)) return;
    setSavingId(m.id);
    try {
      await apiDisableMembership(token, tenantId, m.id);
      setMembers((prev) => prev.filter((mm) => mm.id !== m.id));
    } catch (e) {
      console.error(e);
      setError("Failed to disable user");
    } finally {
      setSavingId(null);
    }
  };

  if (!token) {
    return <div className="text-sm text-red-500">Not authenticated.</div>;
  }

  if (loading) {
    return <div className="text-sm text-[var(--text2)]">Loading users…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-[var(--text)]">Workspace users</h2>
          <p className="text-xs text-[var(--text2)]">
            Manage who has access to this Securifi Connect workspace.
          </p>
        </div>
        {canManage && (
          <Link
            href="/app/settings/users/invite"
            className="inline-flex items-center rounded-lg bg-brand-blue px-3 py-2 text-xs font-medium text-white shadow-sm hover:opacity-90"
          >
            + Invite user
          </Link>
        )}
      </div>

      {error && <div className="text-xs text-red-500">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface2)]">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--surface)] text-xs uppercase text-[var(--text2)]">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Last login</th>
              {canManage && <th className="px-3 py-2 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {members.map((m) => (
              <tr key={m.id} className="align-middle">
                <td className="px-3 py-2 text-[var(--text)]">{m.user.name || "-"}</td>
                <td className="px-3 py-2 text-[var(--text)]">{m.user.email}</td>
                <td className="px-3 py-2">
                  {canManage ? (
                    <select
                      className="border border-[var(--border)] bg-white rounded px-2 py-1 text-xs text-[var(--text)]"
                      value={m.role}
                      disabled={savingId === m.id}
                      onChange={(e) => handleRoleChange(m, e.target.value)}
                    >
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                      <option value="agent">Agent</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    <span className="text-xs text-[var(--text)]">{m.role}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={[
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                      m.status === "active"
                        ? "bg-green-50 text-green-700 border border-green-100"
                        : "bg-slate-100 text-slate-600 border border-slate-200",
                    ].join(" ")}
                  >
                    {m.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-[var(--text2)]">
                  {m.user.last_login_at ? new Date(m.user.last_login_at).toLocaleString() : "—"}
                </td>
                {canManage && (
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => handleDisable(m)}
                      disabled={savingId === m.id}
                      className="text-xs text-red-500 hover:underline disabled:opacity-50"
                    >
                      Disable
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-xs text-[var(--text2)]" colSpan={6}>
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
