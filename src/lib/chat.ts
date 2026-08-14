import { sealReply } from "./crypto/message";

/** Just enough of a message to decide whether a broadcast replaces it. */
type PendingCandidate = {
  direction?: string;
  status?: string | null;
  body?: string | null;
  payload?: { client_message_id?: string } | null;
};

/**
 * Does an arriving broadcast replace this already-rendered message?
 *
 * The client id is the real answer. The body comparison is only a fallback for
 * an optimistic message that never got one — and it must never fire on two
 * absent bodies, because EVERY sealed message has `body === null`, so
 * `null === null` made an arriving sealed message match the first unrelated
 * sealed message still showing "sending" and overwrite it. Observed live on
 * 2026-08-14: a delivered message replaced one that had been stuck pending
 * since the day before, which vanished from the conversation while looking
 * like the new message had simply sorted itself into the wrong place.
 */
export function replacesPendingSend(
  candidate: PendingCandidate,
  incoming: PendingCandidate
): boolean {
  if (candidate.direction !== "outbound" || candidate.status !== "sending") return false;

  const incomingId = incoming.payload?.client_message_id;
  const candidateId = candidate.payload?.client_message_id;
  if (incomingId && candidateId) return incomingId === candidateId;

  // No id to go on: only a real body can identify it.
  return Boolean(incoming.body) && candidate.body === incoming.body;
}

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

  const content = sealReply(payload.body, {
    readers: keys.readers.map((r) => r.public_key),
    engineKey: keys.engine_public_key,
  });

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
