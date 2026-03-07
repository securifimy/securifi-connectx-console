"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { apiGetChannelAccounts } from "@/lib/api";
import { apiSendNewChat } from "@/lib/chat";
import Link from "next/link";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";

interface ChannelAccountOption {
  id: number;
  display_name?: string;
  phone_number?: string | null;
}

export default function NewChatPage() {
  const router = useRouter();
  const { token } = useAuthStore();
  const [phone, setPhone] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const [channelAccountId, setChannelAccountId] = useState<number | null>(null);
  const [accounts, setAccounts] = useState<ChannelAccountOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    const authToken = token as string;
    async function loadAccounts() {
      try {
        const data = await apiGetChannelAccounts(authToken);
        setAccounts(data);
        if (data.length > 0) {
          setChannelAccountId(data[0].id);
        }
      } catch (err) {
        console.error("Failed to load channels for new chat", err);
        setError("Failed to load channels");
      }
    }
    void loadAccounts();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !channelAccountId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiSendNewChat(token, {
        channel_account_id: channelAccountId,
        to: phone,
        body: initialMessage.trim(),
      });
      const conversationId = response.message?.conversation_id;
      if (conversationId) {
        router.replace(`/app/chat/${conversationId}`);
      } else {
        throw new Error("Conversation ID missing");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create chat");
    } finally {
      setLoading(false);
    }
  }

  return (
    <WorkspaceShell
      activeNav="inbox"
      header={{
        title: "New Chat",
        subtitle: "Start a direct conversation and route the first outbound message through an active channel.",
      }}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Link href="/app/chat" className="hover:text-foreground">
              Inbox
            </Link>
            <span>/</span>
            <span className="text-foreground">New chat</span>
          </div>
          <Link
            href="/app/chat"
            className="inline-flex items-center rounded-lg border border-border/60 bg-[hsl(var(--card))] px-3.5 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted"
          >
            Back to inbox
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border/60 bg-[hsl(var(--card))] p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Phone number</label>
                <input
                  className="w-full rounded-xl border border-border/60 bg-[hsl(var(--background))] px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="60123456789"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Outbound channel</label>
                <select
                  className="w-full rounded-xl border border-border/60 bg-[hsl(var(--background))] px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  value={channelAccountId || ""}
                  onChange={(e) => setChannelAccountId(Number(e.target.value))}
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.display_name || acc.phone_number || `Channel ${acc.id}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Opening message</label>
              <textarea
                className="w-full rounded-xl border border-border/60 bg-[hsl(var(--background))] px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                rows={5}
                placeholder="Hello!"
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                required
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading || !channelAccountId}
              className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-[hsl(var(--primary-dark))] disabled:opacity-60"
            >
              {loading ? "Creating..." : "Start chat"}
            </button>
          </form>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-border/60 bg-[hsl(var(--card))] p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground">Before you send</h2>
              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                <p>Choose the active channel that should own the conversation.</p>
                <p>The first message creates the thread and opens the chat immediately after send.</p>
                <p>Use a full international phone number so WhatsApp verification can complete cleanly.</p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </WorkspaceShell>
  );
}
