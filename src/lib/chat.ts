import { sealReply } from "./crypto/message";

const FALLBACK_API_BASE = "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL
  || (typeof window !== "undefined" ? window.location.origin : FALLBACK_API_BASE);

/**
 * Public keys for sealing the first message of a chat that does not exist yet.
 *
 * A conversation is created private, so its opening message has to be sealed
 * like any other — but there is no conversation to ask about yet, which is
 * exactly why this screen used to send plaintext.
 */
export async function apiGetSealingKeys(token: string): Promise<{
  privacy: "private" | "server_readable";
  engine_public_key: string | null;
  readers: Array<{ kid: string; public_key: string }>;
}> {
  const res = await fetch(`${API_BASE}/api/v1/sealing_keys`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Could not load sealing keys (${res.status})`);
  return res.json();
}

export async function apiSendNewChat(
  token: string,
  payload: { to: string; channel_account_id: number; body: string }
) {
  const keys = await apiGetSealingKeys(token);

  // Sealed unless the workspace has explicitly decided otherwise. Rails refuses
  // plaintext into a private conversation, so an unsealed send here would fail
  // loudly rather than quietly storing the message in the clear — but doing it
  // right is the point, not surviving the refusal.
  const content =
    keys.privacy === "private"
      ? sealReply(payload.body, {
          readers: keys.readers.map((r) => r.public_key),
          engineKey: keys.engine_public_key,
        })
      : { body: payload.body };

  const res = await fetch(`${API_BASE}/api/v1/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel_account_id: payload.channel_account_id,
      to: payload.to,
      ...content,
    }),
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error || "Failed to start chat");
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
