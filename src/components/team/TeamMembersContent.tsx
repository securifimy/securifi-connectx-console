"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import {
  apiGetMe,
  apiGetMembers,
  apiUpdateMembership,
  apiDisableMembership,
  Membership,
} from "@/lib/api";

export function TeamMembersContent() {
  const token = useAuthStore((s) => s.token);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const router = useRouter();
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [membershipRole, setMembershipRole] = useState<string | null>(null);
  const [members, setMembers] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState(false);

  const isUnauthorized = (err: unknown): err is { status?: number } =>
    Boolean(err && typeof err === "object" && "status" in err && (err as { status?: number }).status === 401);

  const isForbidden = (err: unknown): err is { status?: number } =>
    Boolean(err && typeof err === "object" && "status" in err && (err as { status?: number }).status === 403);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const authToken = token as string;

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
      } catch (e: unknown) {
        console.error(e);
        if (!cancelled) {
          if (isUnauthorized(e)) {
            clearAuth();
            router.replace("/login");
            return;
          }
          if (isForbidden(e)) {
            setPermissionError(true);
          } else {
            setError("Failed to load team members");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token, clearAuth, router]);

  const canManage = membershipRole === "owner" || membershipRole === "admin";

  const handleRoleChange = async (m: Membership, role: Membership["role"]) => {
    if (!token || !tenantId) return;
    setSavingId(m.id);
    try {
      const authToken = token as string;
      const updated = await apiUpdateMembership(authToken, tenantId, m.id, { role });
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
    return <div className="text-sm text-muted-foreground">Loading team members…</div>;
  }

  if (permissionError) {
    return (
      <div className="text-sm text-muted-foreground">
        You do not have permission to view team members.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        {canManage && (
          <Link
            href="/app/team/invite"
            className="inline-flex items-center rounded-md border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
          >
            + Invite member
          </Link>
        )}
      </div>

      {error && <div className="text-xs text-red-500">{error}</div>}

      <div className="border border-border/60 rounded-xl overflow-hidden bg-[hsl(var(--card))]">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Last login</th>
              {canManage && <th className="px-3 py-2 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-border/40">
                <td className="px-3 py-2">{m.user.name || "-"}</td>
                <td className="px-3 py-2">{m.user.email}</td>
                <td className="px-3 py-2">
                  {canManage ? (
                    <select
                      className="border border-border/60 rounded px-2 py-1 text-xs bg-background"
                      value={m.role}
                      disabled={savingId === m.id}
                      onChange={(e) => handleRoleChange(m, e.target.value as Membership["role"])}
                    >
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                      <option value="agent">Agent</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    <span className="text-xs">{m.role}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] " +
                      (m.status === "active"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-muted text-muted-foreground")
                    }
                  >
                    {m.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {m.user.last_login_at ? new Date(m.user.last_login_at).toLocaleString() : "—"}
                </td>
                {canManage && (
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => handleDisable(m)}
                      disabled={savingId === m.id}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Disable
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-xs text-muted-foreground" colSpan={6}>
                  No team members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
