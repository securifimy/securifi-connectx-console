const FALLBACK_API_BASE = "http://localhost:3000";
let API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

if (typeof window !== "undefined" && !process.env.NEXT_PUBLIC_API_URL) {
  API_BASE = window.location.origin;
}

if (!API_BASE) {
  API_BASE = FALLBACK_API_BASE;
}

export type ApiEntity = Record<string, unknown>;

export interface LoginResponse {
  token: string;
  user: ApiEntity;
  tenant: ApiEntity;
}

export type Tenant = {
  id: number;
  name: string;
  slug: string;
  logo_url?: string;
  allowed_origins?: string[];
  created_at?: string;
  updated_at?: string;
};

export type Membership = {
  id: number;
  role: "owner" | "admin" | "agent" | "viewer";
  status: "active" | "disabled";
  user: {
    id: number;
    name: string;
    email: string;
    last_login_at?: string | null;
  };
  created_at: string;
  updated_at: string;
};

export type Invite = {
  id: number;
  email: string;
  role: "owner" | "admin" | "agent" | "viewer";
  expires_at: string;
  accepted_at?: string | null;
  created_at: string;
};

export type AuditLogEntry = {
  id: number;
  action: string;
  actor_type?: string | null;
  actor_id?: number | null;
  resource_type?: string | null;
  resource_id?: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

// ---------- Superadmin ----------
async function superadminFetch(path: string, params?: Record<string, string | number | undefined>) {
  const qs = params ? new URLSearchParams(Object.entries(params).reduce((acc, [k, v]) => {
    if (v !== undefined && v !== null) acc[k] = String(v);
    return acc;
  }, {} as Record<string, string>)).toString() : "";

  const res = await fetch(`${API_BASE}/api/superadmin/v1${path}${qs ? `?${qs}` : ""}`, {
    headers: {
      Authorization: `Bearer ${typeof window !== "undefined" ? getAuthToken() : ""}`,
    },
  });
  if (!res.ok) throw new Error(`Superadmin request failed (${res.status})`);
  return res.json();
}

function getAuthToken(): string {
  try {
    const raw = localStorage.getItem("securifi_connect_auth");
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return parsed.token || "";
  } catch {
    return "";
  }
}

export async function apiSuperadminStats() {
  return superadminFetch("/stats");
}

export async function apiSuperadminTenants(params?: { q?: string; page?: number }) {
  return superadminFetch("/tenants", params);
}

export async function apiSuperadminTenant(id: number | string) {
  return superadminFetch(`/tenants/${id}`);
}

export async function apiSuperadminUpdateTenant(
  id: number | string,
  attrs: {
    name?: string;
    plan?: string;
    status?: string;
    monthly_quota_messages?: number;
    monthly_quota_api_calls?: number;
    monthly_quota_channels?: number;
    soft_limit?: boolean;
    hard_limit?: boolean;
  }
) {
  const res = await fetch(`${API_BASE}/api/superadmin/v1/tenants/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${typeof window !== "undefined" ? getAuthToken() : ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tenant: attrs }),
  });
  if (!res.ok) throw new Error(`Failed to update tenant (${res.status})`);
  return res.json();
}

export async function apiSuperadminApiLogs(params?: { tenant_id?: string; status?: string; q?: string; page?: number }) {
  return superadminFetch("/api_request_logs", params);
}

export async function apiSuperadminWebhookLogs(params?: { tenant_id?: string; status?: string; event?: string; page?: number }) {
  return superadminFetch("/webhook_deliveries", params);
}

export async function apiSuperadminAuditLogs(params?: { tenant_id?: string; user_id?: string; event_type?: string; page?: number }) {
  return superadminFetch("/audit_logs", params);
}

export async function apiSuperadminSystemHealth() {
  return superadminFetch("/system_health");
}

export async function apiLogin(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error("Invalid credentials");
  }

  return res.json();
}

export interface ChannelAccount {
  id: number;
  display_name: string;
  external_identifier: string | null;
  phone_number?: string | null;
  status: string;
  channel_id: number;
  metadata?: Record<string, unknown> | null;
}

export async function apiGetConversations(
  token: string,
  tenantId: number,
  params: Record<string, string | number | undefined> = {}
): Promise<{ conversations: unknown[]; nextCursor: string | null } | unknown[]> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) query.append(k, String(v));
  });

  const res = await fetch(
    `${API_BASE}/api/v1/tenants/${tenantId}/conversations?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    const error: Error & { status?: number; body?: string } = new Error("Failed to load conversations");
    error.status = res.status;
    try {
      error.body = await res.text();
    } catch {
      // ignore body parse failure
    }
    throw error;
  }
  return res.json();
}

export async function apiGetMessages(
  token: string,
  conversationId: number,
  opts: { cursor?: string | null; limit?: number } = {}
) {
  const query = new URLSearchParams();
  if (opts.cursor) query.set("cursor", opts.cursor);
  if (opts.limit) query.set("limit", String(opts.limit));

  const res = await fetch(
    `${API_BASE}/api/v1/conversations/${conversationId}/messages${query.toString() ? `?${query.toString()}` : ""}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error("Failed to load messages");
  return res.json();
}

export async function apiGetConversation(
  token: string,
  conversationId: number
) {
  const res = await fetch(`${API_BASE}/api/v1/conversations/${conversationId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Failed to load conversation");
  return res.json();
}

export async function apiGetGroupParticipants(
  token: string,
  conversationId: number
): Promise<{ participants: Array<{ jid: string; name: string }> }> {
  const res = await fetch(
    `${API_BASE}/api/v1/conversations/${conversationId}/group_participants`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error("Failed to load group participants");
  }

  return res.json();
}

export async function apiSendMessage(
  token: string,
  conversationId: number,
  body: string,
  clientMessageId?: string
) {
  const res = await fetch(
    `${API_BASE}/api/v1/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body, client_message_id: clientMessageId }),
    }
  );
  if (!res.ok) throw new Error("Failed to send message");
  return res.json();
}

export async function apiGetChannelAccounts(token: string): Promise<ChannelAccount[]> {
  const res = await fetch(`${API_BASE}/api/v1/channel_accounts`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const error: Error & { status?: number; body?: string } = new Error("Failed to load channel accounts");
    error.status = res.status;
    try {
      error.body = await res.text();
    } catch {
      // ignore
    }
    throw error;
  }
  const data = await res.json();
  return data.channel_accounts || [];
}

export async function apiGetChannelAccountSessionStatus(
  token: string,
  channelAccountId: number
) {
  const res = await fetch(
    `${API_BASE}/api/v1/channel_accounts/${channelAccountId}/session_status`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) throw new Error("Failed to load session status");
  return res.json();
}

export async function apiGetChannelAccountQr(
  token: string,
  channelAccountId: number
) {
  const res = await fetch(
    `${API_BASE}/api/v1/channel_accounts/${channelAccountId}/qr`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) throw new Error("Failed to load QR");
  return res.json();
}

export async function apiCreateChannelAccount(
  token: string,
  payload: Record<string, unknown>
) {
  const res = await fetch(`${API_BASE}/api/v1/channel_accounts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error("Failed to create channel");
  return res.json();
}

export async function updateChannelAccount(
  token: string,
  channelAccountId: number,
  payload: Record<string, unknown>
) {
  const res = await fetch(`${API_BASE}/api/v1/channel_accounts/${channelAccountId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error("Failed to update channel account");
  return res.json();
}

export async function apiGetChannelAccount(
  token: string,
  channelAccountId: number
) {
  const res = await fetch(`${API_BASE}/api/v1/channel_accounts/${channelAccountId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Failed to load channel account");
  return res.json();
}

export async function apiStartChannelAccountSession(
  token: string,
  channelAccountId: number,
  options: { forceRestart?: boolean } = {}
) {
  const res = await fetch(`${API_BASE}/api/v1/channel_accounts/${channelAccountId}/start`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      force_restart: options.forceRestart === true,
    }),
  });

  if (!res.ok) throw new Error("Failed to start WhatsApp session");
  return res.json();
}

export async function apiDisconnectChannelAccount(
  token: string,
  channelAccountId: number
) {
  const res = await fetch(`${API_BASE}/api/v1/channel_accounts/${channelAccountId}/disconnect`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) throw new Error("Failed to disconnect channel account");
  return res.json();
}

export async function apiDeleteChannelAccount(token: string, channelAccountId: number) {
  const res = await fetch(`${API_BASE}/api/v1/channel_accounts/${channelAccountId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error("Failed to delete channel account");
  return true;
}

export async function apiAnalyzeConversation(
  token: string,
  conversationId: number
) {
  const res = await fetch(`${API_BASE}/api/v1/ai/analyze_conversation`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ conversation_id: conversationId }),
  });

  if (!res.ok) {
    const error: Error & { status?: number; body?: string } = new Error("Failed to analyze conversation");
    error.status = res.status;
    try {
      error.body = await res.text();
    } catch {
      // ignore
    }
    throw error;
  }
  return res.json();
}

export async function apiSuggestReply(
  token: string,
  conversationId: number
) {
  const res = await fetch(`${API_BASE}/api/v1/ai/suggest_reply`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ conversation_id: conversationId }),
  });

  if (!res.ok) {
    const error: Error & { status?: number; body?: string } = new Error("Failed to fetch suggestions");
    error.status = res.status;
    try {
      error.body = await res.text();
    } catch {
      // ignore
    }
    throw error;
  }
  return res.json();
}

export async function apiListChannelApiKeys(
  token: string,
  channelAccountId: number
) {
  const res = await fetch(
    `${API_BASE}/api/v1/channel_accounts/${channelAccountId}/channel_api_keys`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!res.ok) throw new Error("Failed to load API keys");
  return res.json();
}

export async function apiCreateChannelApiKey(
  token: string,
  channelAccountId: number,
  body: { label?: string; scopes?: string[] }
) {
  const res = await fetch(
    `${API_BASE}/api/v1/channel_accounts/${channelAccountId}/channel_api_keys`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error("Failed to create API key");
  return res.json();
}

export async function apiDeleteChannelApiKey(
  token: string,
  channelAccountId: number,
  keyId: number
) {
  const res = await fetch(
    `${API_BASE}/api/v1/channel_accounts/${channelAccountId}/channel_api_keys/${keyId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!res.ok) throw new Error("Failed to delete API key");
  return true;
}

export async function apiGetWebhookDeliveries(
  token: string,
  channelAccountId: number
) {
  const res = await fetch(
    `${API_BASE}/api/v1/channel_accounts/${channelAccountId}/webhook_deliveries`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!res.ok) throw new Error("Failed to load webhook deliveries");
  return res.json();
}

export async function apiReplayWebhookDelivery(token: string, deliveryId: number) {
  const res = await fetch(`${API_BASE}/api/v1/webhook_deliveries/${deliveryId}/replay`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error("Failed to replay webhook delivery");
  return res.json();
}

export async function apiGetApiRequestLogs(
  token: string,
  channelAccountId: number
) {
  const res = await fetch(
    `${API_BASE}/api/v1/channel_accounts/${channelAccountId}/api_request_logs`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!res.ok) throw new Error("Failed to load API logs");
  return res.json();
}

export async function apiGetBillingSummary(token: string) {
  const res = await fetch(`${API_BASE}/api/v1/billing/summary`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error("Failed to load billing summary");
  return res.json();
}

export async function apiGetInvoices(token: string) {
  const res = await fetch(`${API_BASE}/api/v1/billing/invoices`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error("Failed to load invoices");
  return res.json();
}

export async function apiGetChannelUsage(token: string, channelAccountId: number) {
  const res = await fetch(`${API_BASE}/api/v1/channel_accounts/${channelAccountId}/usage`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error("Failed to load channel usage");
  return res.json();
}

export async function apiAuthForgotPassword(email: string) {
  const res = await fetch(`${API_BASE}/api/v1/auth/forgot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error("Failed to request reset");
  return res.json();
}

export async function apiAuthResetPassword(params: {
  token: string;
  password: string;
  password_confirmation: string;
}) {
  const res = await fetch(`${API_BASE}/api/v1/auth/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const data: { error?: string } = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to reset password");
  }
  return res.json() as Promise<{ token: string; user: ApiEntity; tenant: ApiEntity }>;
}

export async function apiAcceptInvite(params: {
  token: string;
  name: string;
  password: string;
  password_confirmation: string;
}) {
  const res = await fetch(`${API_BASE}/api/v1/invites/${params.token}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: params.name,
      password: params.password,
      password_confirmation: params.password_confirmation,
    }),
  });
  if (!res.ok) {
    const data: { error?: string } = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to accept invite");
  }
  return res.json() as Promise<{ token: string; user: ApiEntity; tenant: ApiEntity }>;
}

export async function apiRegister(params: {
  name: string;
  email: string;
  plan_code?: string;
}) {
  const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user: { name: params.name, email: params.email },
      plan_code: params.plan_code || "free",
      tenant: { name: params.name },
    }),
  });
  if (!res.ok) {
    const data: { error?: string } = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to register");
  }
  return res.json();
}

export async function apiVerifySignup(params: { token: string; password: string }) {
  const res = await fetch(`${API_BASE}/api/v1/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const data: { error?: string } = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to verify");
  }
  return res.json() as Promise<{ token: string; user: ApiEntity; tenant: ApiEntity; membership?: ApiEntity }>;
}

export async function apiGetMe(token: string) {
  const res = await fetch(`${API_BASE}/api/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const error: Error & { status?: number; body?: string } = new Error("Failed to load profile");
    error.status = res.status;
    try {
      error.body = await res.text();
    } catch {
      // ignore
    }
    throw error;
  }
  return res.json();
}

export async function apiGetMembers(token: string, tenantId: number) {
  const res = await fetch(`${API_BASE}/api/v1/tenants/${tenantId}/memberships`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const error: Error & { status?: number; body?: string } = new Error("Failed to load members");
    error.status = res.status;
    try {
      error.body = await res.text();
    } catch {
      // ignore
    }
    throw error;
  }
  return res.json();
}

export async function apiUpdateMembership(
  token: string,
  tenantId: number,
  membershipId: number,
  attrs: Partial<Pick<Membership, "role" | "status">>
) {
  const res = await fetch(`${API_BASE}/api/v1/tenants/${tenantId}/memberships/${membershipId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ membership: attrs }),
  });
  if (!res.ok) throw new Error("Failed to update membership");
  return res.json();
}

export async function apiDisableMembership(token: string, tenantId: number, membershipId: number) {
  const res = await fetch(`${API_BASE}/api/v1/tenants/${tenantId}/memberships/${membershipId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to disable membership");
  return true;
}

export async function apiGetInvites(token: string, tenantId: number) {
  const res = await fetch(`${API_BASE}/api/v1/tenants/${tenantId}/invites`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load invites");
  return res.json();
}

export async function apiCreateInvite(
  token: string,
  tenantId: number,
  payload: { email: string; role: string }
) {
  const res = await fetch(`${API_BASE}/api/v1/tenants/${tenantId}/invites`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ invite: payload }),
  });
  if (!res.ok) throw new Error("Failed to create invite");
  return res.json();
}

export async function apiGetTenant(token: string, tenantId: number): Promise<Tenant> {
  const res = await fetch(`${API_BASE}/api/v1/tenants/${tenantId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load tenant");
  return res.json();
}

export async function apiUpdateTenant(
  token: string,
  tenantId: number,
  attrs: Partial<Pick<Tenant, "name" | "slug">>
) {
  const res = await fetch(`${API_BASE}/api/v1/tenants/${tenantId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tenant: attrs }),
  });
  if (!res.ok) throw new Error("Failed to update tenant");
  return res.json();
}

export async function apiGetAuditLogs(
  token: string,
  params: { limit?: number; event_type?: string } = {}
): Promise<AuditLogEntry[]> {
  const qs = new URLSearchParams();
  if (params.limit) qs.set("limit", params.limit.toString());
  if (params.event_type) qs.set("event_type", params.event_type);
  const res = await fetch(`${API_BASE}/api/v1/audit_logs${qs.toString() ? `?${qs.toString()}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load audit logs");
  return res.json();
}
