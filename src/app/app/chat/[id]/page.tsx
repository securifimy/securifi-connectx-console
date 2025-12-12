"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import {
  apiAnalyzeConversation,
  apiGetConversation,
  apiGetMessages,
  apiSendMessage,
  apiSuggestReply,
  apiGetConversations,
} from "@/lib/api";
import { getCable } from "@/lib/cable";
import { ConversationSummary } from "@/components/chat/ConversationSummary";
import { SuggestionBar } from "@/components/chat/SuggestionBar";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { ConversationListItem } from "@/components/chat/ConversationListItem";

interface Conversation {
  id: number;
  external_user_id: string;
  external_user_name: string;
  status: string;
  channel_account?: {
    id: number;
    display_name?: string;
    phone_number?: string | null;
  };
  summary?: string | null;
  ai_tags?: string[] | null;
  spam_score?: number | null;
  intent?: string | null;
  sentiment?: string | null;
}

interface Message {
  id: number;
  direction: string;
  body: string;
  status: string;
  sent_at: string | null;
  created_at?: string | null;
}

type ConversationUpdatePayload = {
  type: "conversation_update";
  conversation: Conversation;
};

function isUnauthorized(error: unknown): error is { status?: number } {
  return Boolean(
    error &&
    typeof error === "object" &&
    "status" in error &&
    (error as { status?: number }).status === 401
  );
}

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { token, clearAuth } = useAuthStore();
  const { tenant } = useAuthStore();
  const conversationId = Number(params?.id);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const skipScrollRef = useRef(false);
  const aiEnabled = process.env.NEXT_PUBLIC_AI_FEATURES_ENABLED === "true";

  useEffect(() => {
    setSuggestions([]);
  }, [conversationId]);

  useEffect(() => {
    if (!token || !conversationId) return;
    const authToken = token as string;

    async function loadConversation() {
      setLoading(true);
      try {
        const convo = await apiGetConversation(authToken, conversationId);
        setConversation(convo);
        const data = await apiGetMessages(authToken, conversationId, { limit: 20 });
        const msgs = Array.isArray(data) ? data : data.messages;
        const cursor = Array.isArray(data) ? null : data.nextCursor;
        setMessages(deduplicateMessages(msgs));
        setNextCursor(cursor ?? null);
      } catch (err) {
        console.error("Failed to load conversation", err);
        if (isUnauthorized(err)) {
          clearAuth();
          router.replace("/login");
        } else {
          router.replace("/app/chat");
        }
      } finally {
        setLoading(false);
      }
    }

    loadConversation();
  }, [token, conversationId, router, clearAuth]);

  useEffect(() => {
    const tenantId = tenant?.id;
    if (!token || typeof tenantId !== "number") return;
    const authToken = token as string;
    async function loadList() {
      try {
        const data = await apiGetConversations(authToken, tenantId as number);
        const convs = Array.isArray(data) ? data : data.conversations;
        setConversations(convs as Conversation[]);
      } catch (err) {
        console.error("Failed to load conversation list", err);
      }
    }
    loadList();
  }, [token, tenant?.id]);

  useEffect(() => {
    if (!conversationId || !token) return;
    const consumer = getCable(token);
    const subscription = consumer.subscriptions.create(
      { channel: "ConversationsChannel", id: conversationId },
      {
        received: (data: unknown) => {
          if (isConversationUpdatePayload(data)) {
            setConversation((prev) => ({ ...(prev || {}), ...data.conversation } as Conversation));
            return;
          }

          const message = data as Message;
          setMessages((prev) => {
            // If we have an optimistic "sending" outbound with the same body, replace it.
            if (message.direction === "outbound") {
              const idx = prev.findIndex(
                (m) => m.direction === "outbound" && m.status === "sending" && m.body === message.body
              );
              if (idx !== -1) {
                const next = [...prev];
                next[idx] = message;
                return deduplicateMessages(next);
              }
            }
            return deduplicateMessages([...prev, message]);
          });
        },
      }
    );
    return () => {
      subscription.unsubscribe();
    };
  }, [conversationId, token]);

  useEffect(() => {
    if (skipScrollRef.current) {
      skipScrollRef.current = false;
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Infinite scroll (load older)
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          void handleLoadOlder();
        }
      },
      { root: messagesContainerRef.current, threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [nextCursor, loadingOlder, token]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !conversation || !newMessage.trim()) return;

    const optimistic: Message = {
      id: Date.now(),
      direction: "outbound",
      body: newMessage.trim(),
      status: "sending",
      sent_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setNewMessage("");

    try {
      await apiSendMessage(token, conversation.id, optimistic.body);
    } catch (err) {
      console.error("Failed to send", err);
    }
  }

  async function handleRefreshSummary() {
    if (!token || !conversation) return;
    const authToken = token as string;
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const data = await apiAnalyzeConversation(authToken, conversation.id);
      setConversation((prev) =>
        prev
          ? {
              ...prev,
              summary: data.summary,
              ai_tags: data.tags,
              spam_score: data.spam_score,
              intent: data.intent,
              sentiment: data.sentiment,
            }
          : prev
      );
    } catch (err) {
      console.error("Failed to analyze conversation", err);
      if (isUnauthorized(err)) {
        clearAuth();
        router.replace("/login");
      } else {
        setAnalysisError("Unable to analyze conversation right now.");
      }
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function handleLoadSuggestions() {
    if (!token || !conversation) return;
    const authToken = token as string;
    setSuggestionsLoading(true);
    setSuggestionError(null);
    try {
      const data = await apiSuggestReply(authToken, conversation.id);
      setSuggestions(data.suggestions || []);
    } catch (err) {
      console.error("Failed to load suggestions", err);
      setSuggestions([]);
      if (isUnauthorized(err)) {
        clearAuth();
        router.replace("/login");
      } else {
        setSuggestionError("Unable to load suggestions. Try again later.");
      }
    } finally {
      setSuggestionsLoading(false);
    }
  }

  async function handleLoadOlder() {
    if (!token || !conversation || !nextCursor || loadingOlder) return;
    const container = messagesContainerRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;
    const prevScrollTop = container?.scrollTop ?? 0;
    setLoadingOlder(true);
    try {
      const data = await apiGetMessages(token, conversation.id, { cursor: nextCursor, limit: 20 });
      const older = Array.isArray(data) ? data : data.messages;
      const cursor = Array.isArray(data) ? null : data.nextCursor;
      skipScrollRef.current = true;
      setMessages((prev) => deduplicateMessages([...older, ...prev]));
      setNextCursor(cursor ?? null);
      // Preserve scroll position after prepending
      requestAnimationFrame(() => {
        const newHeight = container?.scrollHeight ?? 0;
        if (container) {
          container.scrollTop = newHeight - prevScrollHeight + prevScrollTop;
        }
      });
    } catch (err) {
      console.error("Failed to load older messages", err);
    } finally {
      setLoadingOlder(false);
    }
  }

  if (loading || !conversation) {
    return (
      <WorkspaceShell activeNav="inbox">
        <div className="flex items-center justify-center text-muted-foreground h-[60vh]">
          Loading conversation…
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell activeNav="inbox" layout="chat-2col">
      <section className="col-span-4 h-full border-r border-border/60 bg-[hsl(var(--card))] overflow-y-auto px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-foreground">Conversations</h2>
          <button
            onClick={() => router.push("/app/chat")}
            className="text-xs text-primary hover:underline"
          >
            View all
          </button>
        </div>
        <div className="space-y-2">
          {conversations.map((conv) => (
            <ConversationListItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === conversationId}
              onClick={() => router.push(`/app/chat/${conv.id}`)}
            />
          ))}
        </div>
      </section>

      <section className="col-span-8 h-full flex flex-col rounded-none border-l border-border/60 bg-[hsl(var(--card))] shadow-sm overflow-hidden">
        <header className="h-16 border-b border-border/40 flex items-center justify-between px-6 bg-[hsl(var(--muted))]/40">
          <div>
            <h1 className="text-[20px] font-semibold text-foreground">
              {conversation.external_user_name || conversation.external_user_id}
            </h1>
            <p className="text-[12px] text-muted-foreground">
              via {conversation.channel_account?.display_name || conversation.channel_account?.phone_number || "Channel"}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-3 py-1 text-[12px]">
              {conversation.channel_account?.display_name || "Channel"}
            </span>
            {conversation.status && (
              <span
                className={clsx(
                  "inline-flex items-center rounded-full px-3 py-1 text-[12px] font-medium",
                  conversation.status === "closed"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                    : "bg-amber-50 text-amber-700 border border-amber-100"
                )}
              >
                {conversation.status === "closed" ? "Closed" : "Open"}
              </span>
            )}
          </div>
        </header>

        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-[hsl(var(--background))]"
        >
          <div className="rounded-xl border border-border/60 bg-[hsl(var(--card))] p-3">
            <ConversationSummary
              summary={conversation.summary}
              intent={conversation.intent}
              sentiment={conversation.sentiment}
              spamScore={conversation.spam_score}
              tags={conversation.ai_tags}
              loading={analysisLoading}
              error={analysisError}
              onRefresh={handleRefreshSummary}
            />
          </div>

          <div className="space-y-3">
            <div ref={topSentinelRef} className="h-1 w-full" />
            {loadingOlder && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-4 w-4 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
                Loading earlier messages…
              </div>
            )}
            {messages.map((msg) => {
              const isOutbound = msg.direction === "outbound";
              const isMedia =
                !msg.body ||
                msg.body.includes("[media message]") ||
                msg.body.startsWith("data:") ||
                msg.body.startsWith("/9j/") ||
                msg.body.length > 500;
              return (
                <div
                  key={msg.id}
                  className={isOutbound ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={clsx(
                      "max-w-[70%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm break-words",
                      isOutbound
                        ? "bg-primary/10 text-foreground rounded-br-sm ml-auto"
                        : "bg-[hsl(var(--card))] border border-border/40 text-foreground rounded-bl-sm mr-auto"
                    )}
                  >
                    {isMedia ? (
                      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground/80 text-xs font-medium">
                          📎
                        </span>
                        <div className="leading-tight">
                          <p className="font-medium text-foreground/90">Media attachment</p>
                          <p className="text-[12px] text-muted-foreground break-all">
                            {msg.body && msg.body.length > 10 ? `${msg.body.slice(0, 10)}…` : msg.body || "Unsupported media"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.body}</p>
                    )}
                    <div className={clsx("mt-1 text-[11px] text-muted-foreground", isOutbound ? "text-right" : "text-left")}>
                      {msg.sent_at ? new Date(msg.sent_at).toLocaleString() : "Pending send"}
                      {isOutbound && msg.status ? ` · ${msg.status}` : ""}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {aiEnabled && conversation && (
          <div className="border-t border-border/40 bg-[hsl(var(--card))]">
            <SuggestionBar
              suggestions={suggestions}
              loading={suggestionsLoading}
              error={suggestionError}
              onPick={(text) => setNewMessage(text)}
              onRefresh={handleLoadSuggestions}
            />
          </div>
        )}

        <form onSubmit={handleSend} className="border-t border-border/40 bg-[hsl(var(--card))] px-6 py-4">
          <div className="flex items-end gap-3">
            <textarea
              rows={1}
              className="flex-1 resize-none rounded-full border border-border/40 bg-[hsl(var(--muted))]/60 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              placeholder="Type a message…"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
            />
            <button
              type="submit"
              className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-[hsl(var(--primary-dark))] disabled:opacity-60"
              disabled={!newMessage.trim()}
            >
              Send
            </button>
          </div>
        </form>
      </section>

    </WorkspaceShell>
  );
}

function isConversationUpdatePayload(data: unknown): data is ConversationUpdatePayload {
  return Boolean(
    data &&
    typeof data === "object" &&
    "type" in data &&
    (data as ConversationUpdatePayload).type === "conversation_update"
  );
}

function deduplicateMessages(msgs: Message[]) {
  const seen = new Map<string, Message>();
  for (const m of msgs) {
    const key = m.id ? `id:${m.id}` : `body:${m.direction}:${m.body}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, m);
      continue;
    }
    // Prefer non-sending over sending, or latest sent_at.
    if (existing.status === "sending" && m.status !== "sending") {
      seen.set(key, m);
    } else if (existing.sent_at && m.sent_at) {
      seen.set(
        key,
        new Date(m.sent_at).getTime() >= new Date(existing.sent_at).getTime() ? m : existing
      );
    } else {
      seen.set(key, m);
    }
  }
  return Array.from(seen.values());
}
