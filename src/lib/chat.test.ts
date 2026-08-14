import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiSendNewChat, replacesPendingSend } from "./chat";

// Both calls inside apiSendNewChat go out through fetch — the sealing keys, then
// the send — so one stub covers the whole path.
function stubFetch(privacy: string) {
  const posted: unknown[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("sealing_keys")) {
        return new Response(
          JSON.stringify({
            privacy,
            engine_public_key: "3wJUyZ8Y0dJmB1Nl0h1lqQm5mF9rZ1J8kZ3cQ0mXxWc=",
            readers: [{ kid: "r1", public_key: "3wJUyZ8Y0dJmB1Nl0h1lqQm5mF9rZ1J8kZ3cQ0mXxWc=" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      posted.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ id: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return posted;
}

describe("starting a new chat", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("seals into a server_readable conversation, not just a private one", async () => {
    // The branch this replaces sent plaintext for anything not marked private.
    // A plain API send demotes a conversation, so after Task 12 that is a
    // reachable state — and the words would have gone in the clear.
    const posted = stubFetch("server_readable");

    await apiSendNewChat("token", { to: "60123456789", channel_account_id: 1, body: "boleh" });

    expect(posted[0]).toHaveProperty("sealed_body");
    expect(posted[0]).not.toHaveProperty("body");
  });

  it("still seals a private conversation", async () => {
    const posted = stubFetch("private");

    await apiSendNewChat("token", { to: "60123456789", channel_account_id: 1, body: "boleh" });

    expect(posted[0]).toHaveProperty("sealed_body");
  });
});

describe("deciding what a broadcast replaces", () => {
  const sealedPending = {
    direction: "outbound",
    status: "sending",
    body: null,
    payload: null,
  };

  it("does not let one sealed message overwrite an unrelated pending one", () => {
    // The bug this exists for, seen live on 2026-08-14: every sealed message
    // has body === null, so a `body === body` fallback compared null to null,
    // matched a message stuck pending since the day before, and overwrote it.
    // The stuck message disappeared from the conversation and the new one
    // appeared in its slot — which reads as bad sorting, not as data loss.
    const arriving = {
      direction: "outbound",
      status: "read",
      body: null,
      payload: { client_message_id: "cm_new" },
    };

    expect(replacesPendingSend(sealedPending, arriving)).toBe(false);
  });

  it("replaces the optimistic copy it actually belongs to", () => {
    const optimistic = { ...sealedPending, payload: { client_message_id: "cm_1" } };
    const arriving = { direction: "outbound", status: "read", body: null,
                       payload: { client_message_id: "cm_1" } };

    expect(replacesPendingSend(optimistic, arriving)).toBe(true);
  });

  it("still matches a plaintext send that never got a client id", () => {
    const optimistic = { ...sealedPending, body: "boleh" };
    const arriving = { direction: "outbound", status: "sent", body: "boleh", payload: null };

    expect(replacesPendingSend(optimistic, arriving)).toBe(true);
  });

  it("leaves a message alone once it is no longer sending", () => {
    const settled = { ...sealedPending, status: "delivered", body: "boleh" };
    const arriving = { direction: "outbound", status: "sent", body: "boleh", payload: null };

    expect(replacesPendingSend(settled, arriving)).toBe(false);
  });
});
