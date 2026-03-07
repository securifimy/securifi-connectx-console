const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export async function apiSendNewChat(
  token: string,
  payload: { to: string; channel_account_id: number; body: string }
) {
  const res = await fetch(`${API_BASE}/api/v1/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel_account_id: payload.channel_account_id,
      to: payload.to,
      body: payload.body,
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to start chat");
  }

  return res.json();
}

export function formatPhoneFromExternalId(externalId?: string | null) {
  if (!externalId) return null;
  if (externalId.endsWith("@g.us")) return null;
  const raw = externalId.includes("@") ? externalId.split("@")[0] : externalId;
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return null;
  return `+${digits}`;
}
