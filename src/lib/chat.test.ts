import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiSendNewChat } from "./chat";

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
