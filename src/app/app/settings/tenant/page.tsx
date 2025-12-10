"use client";

import { useAuthStore } from "@/lib/auth-store";
import { apiGetMe, apiGetTenant, apiUpdateTenant, Tenant } from "@/lib/api";
import { useEffect, useState } from "react";

export default function TenantSettingsPage() {
  const token = useAuthStore((s) => s.token);
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [form, setForm] = useState<{
    name: string;
    slug: string;
    logo_url: string;
    allowed_origins: string;
  }>({
    name: "",
    slug: "",
    logo_url: "",
    allowed_origins: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canEdit = role === "owner" || role === "admin";

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
        setRole(me.membership.role);

        const t = await apiGetTenant(authToken, me.tenant.id);
        if (cancelled) return;
        setTenant(t);
        const allowed = Array.isArray((t as Tenant).allowed_origins)
          ? ((t as Tenant).allowed_origins as string[])
          : [];
        setForm({
          name: t.name,
          slug: t.slug,
          logo_url: t.logo_url || "",
          allowed_origins: allowed.join("\n"),
        });
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Failed to load workspace");
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
    if (!token || !tenantId || !canEdit) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        allowed_origins: form.allowed_origins
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      };
      const updated = await apiUpdateTenant(token, tenantId, payload);
      setTenant(updated);
    } catch (e: unknown) {
      console.error(e);
      setError("Failed to update workspace");
    } finally {
      setSaving(false);
    }
  };

  if (!token) {
    return <div className="text-sm text-red-500">Not authenticated.</div>;
  }

  if (loading) {
    return <div className="text-sm text-[var(--text2)]">Loading workspace…</div>;
  }

  if (!tenant) {
    return <div className="text-sm text-red-500">Workspace not found.</div>;
  }

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <h2 className="text-base font-semibold text-[var(--text)]">Workspace profile</h2>
        <p className="text-xs text-[var(--text2)]">
          This is how your Securifi Connect workspace appears to team members.
        </p>
      </div>

      {error && <div className="text-xs text-red-500">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-ui-border bg-white p-4 shadow-sm">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-[var(--text2)]">Name</label>
          <input
            type="text"
            className="w-full border border-ui-border rounded px-3 py-2 text-sm bg-white text-[var(--text)]"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            disabled={!canEdit}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-[var(--text2)]">
            Slug
            <span className="ml-1 text-[10px] text-[var(--text2)]">(used in internal references)</span>
          </label>
          <input
            type="text"
            className="w-full border border-ui-border rounded px-3 py-2 text-sm bg-white text-[var(--text)]"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            disabled={!canEdit}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-[var(--text2)]">Logo URL</label>
          <input
            type="text"
            className="w-full border border-ui-border rounded px-3 py-2 text-sm bg-white text-[var(--text)]"
            value={form.logo_url}
            onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
            disabled={!canEdit}
            placeholder="https://…"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-[var(--text2)]">
            Allowed Origins
            <span className="ml-1 text-[10px] text-[var(--text2)]">(one per line)</span>
          </label>
          <textarea
            className="w-full border border-ui-border rounded px-3 py-2 text-sm bg-white text-[var(--text)]"
            rows={3}
            value={form.allowed_origins}
            onChange={(e) => setForm((f) => ({ ...f, allowed_origins: e.target.value }))}
            disabled={!canEdit}
            placeholder="https://console.connect.securifi.com.my"
          />
        </div>

        {canEdit ? (
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        ) : (
          <p className="text-xs text-[var(--text2)]">
            You don&apos;t have permission to edit workspace settings. Ask an admin or owner.
          </p>
        )}
      </form>
    </div>
  );
}
