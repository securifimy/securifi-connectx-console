"use client";

import clsx from "clsx";
import { resolveMessageBody, sealReply } from "@/lib/crypto/message";
import { ReaderKeyGate } from "@/components/crypto/ReaderKeyGate";
import type { Envelope } from "@/lib/crypto/vault";
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
  apiGetGroupParticipants,
  apiGetConversationReaderKeys,
} from "@/lib/api";
import { formatPhoneFromExternalId } from "@/lib/chat";
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
  kind?: string | null;
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
  /** Present when the engine sealed this message; see lib/crypto. */
  sealed_body?: Envelope | null;
  encrypted?: boolean;
  status: string;
  sent_at: string | null;
  created_at?: string | null;
  sender_external_id?: string | null;
  payload?: Record<string, unknown> | null;
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
  const [participantMap, setParticipantMap] = useState<Record<string, string>>({});
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const skipScrollRef = useRef(false);
  const hasScrolledUpRef = useRef(false);
  const prevScrollTopRef = useRef(0);
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
    if (!token || !conversation) return;

    const isGroupConversation =
      conversation.kind === "group" || conversation.external_user_id?.endsWith("@g.us");

    if (!isGroupConversation) {
      setParticipantMap({});
      return;
    }

    let cancelled = false;
    const authToken = token as string;

    const convoId = conversation.id;

    async function loadParticipants() {
      try {
        const data = await apiGetGroupParticipants(authToken, convoId);
        if (cancelled) return;
        const map: Record<string, string> = {};
        data.participants.forEach((participant) => {
          if (participant.jid && participant.name) {
            map[participant.jid] = participant.name;
          }
        });
        setParticipantMap(map);
      } catch (err) {
        console.warn("Failed to load group participants", err);
      }
    }

    loadParticipants();
    return () => {
      cancelled = true;
    };
  }, [token, conversation]);

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
            if (message.direction === "outbound") {
              const incomingClientId = getClientMessageId(message);
              const idx = prev.findIndex((m) => {
                if (m.direction !== "outbound" || m.status !== "sending") return false;
                const optimisticClientId = getClientMessageId(m);
                if (incomingClientId && optimisticClientId) {
                  return incomingClientId === optimisticClientId;
                }
                return m.body === message.body;
              });
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

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollTop < prevScrollTopRef.current) {
      hasScrolledUpRef.current = true;
    }
    prevScrollTopRef.current = scrollTop;
    const nearTop = scrollTop <= 80;
    const hasOverflow = scrollHeight > clientHeight;
    if (hasOverflow && nearTop && hasScrolledUpRef.current) {
      void handleLoadOlder();
    }
  };

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !conversation || !newMessage.trim()) return;

    const clientMessageId = `cm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: Message = {
      id: Date.now(),
      direction: "outbound",
      body: newMessage.trim(),
      status: "sending",
      sent_at: new Date().toISOString(),
      payload: { client_message_id: clientMessageId },
    };
    setMessages((prev) => [...prev, optimistic]);
    setNewMessage("");
    setSendError(null);

    try {
      // Asked per send rather than cached: a colleague who enrolled a key a
      // minute ago must be able to read this reply, and a stale list would
      // silently leave them out of their own conversation.
      const keys = await apiGetConversationReaderKeys(token, conversation.id);

      const payload =
        keys.privacy === "private"
          ? sealReply(optimistic.body, {
              readers: keys.readers.map((r) => r.public_key),
              engineKey: keys.engine_public_key,
            })
          : { body: optimistic.body };

      await apiSendMessage(token, conversation.id, payload, clientMessageId);
    } catch (err) {
      console.error("Failed to send", err);
      // Said out loud, on screen. A reply that was refused for a key problem
      // looks exactly like one that was sent, and the agent would carry on
      // believing the customer had been answered.
      setSendError(err instanceof Error ? err.message : "The message could not be sent.");
      setMessages((prev) =>
        prev.map((m) =>
          getClientMessageId(m) === clientMessageId ? { ...m, status: "error", sent_at: null } : m
        )
      );
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
    if (!aiAllowed || !token || !conversation) return;
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
      <WorkspaceShell
        activeNav="inbox"
        header={{
          title: "Inbox",
          subtitle: "Conversation timeline, AI context, and send controls for the selected thread.",
        }}
      >
        <div className="flex items-center justify-center text-muted-foreground h-[60vh]">
          Loading conversation…
        </div>
      </WorkspaceShell>
    );
  }

  const isGroupConversation =
    conversation.kind === "group" || conversation.external_user_id?.endsWith("@g.us");
  const aiAllowed = aiEnabled && !isGroupConversation;
  const phoneLabel = formatPhoneFromExternalId(conversation.external_user_id);

  const resolveSenderName = (msg: Message) => {
    const payload = msg.payload as {
      author_display_name?: string;
      raw?: { sender?: Record<string, unknown>; author?: string };
    } | null;
    const rawSender = payload?.raw?.sender as Record<string, unknown> | undefined;
    const candidate =
      payload?.author_display_name ||
      (rawSender?.pushname as string | undefined) ||
      (rawSender?.name as string | undefined) ||
      (rawSender?.formattedName as string | undefined);

    if (candidate && !candidate.includes("@")) {
      return candidate;
    }

    const rawAuthor = payload?.raw?.author || null;
    const mapped =
      (msg.sender_external_id ? participantMap[msg.sender_external_id] : null) ||
      (rawAuthor ? participantMap[rawAuthor] : null);
    if (mapped && !mapped.includes("@")) {
      return mapped;
    }

    return "Member";
  };

  return (
    <WorkspaceShell
      activeNav="inbox"
      layout="chat-2col"
      header={{
        title: "Inbox",
        subtitle: "Conversation timeline, AI context, and send controls for the selected thread.",
      }}
    >
      <section className="col-span-4 h-full min-h-0 border-r border-border/60 bg-[hsl(var(--card))] px-4 py-4 space-y-3 flex flex-col">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-foreground">Conversations</h2>
          <button
            onClick={() => router.push("/app/chat")}
            className="text-xs text-primary hover:underline"
          >
            View all
          </button>
        </div>
        <div className="flex-1 min-h-0 space-y-2 overflow-y-auto pr-1">
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

      <section className="col-span-8 h-full min-h-0 flex flex-col rounded-none border-l border-border/60 bg-[hsl(var(--card))] shadow-sm overflow-hidden">
        <header className="h-16 border-b border-border/40 flex items-center justify-between px-6 bg-[hsl(var(--muted))]/40">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[20px] font-semibold text-foreground">
                {conversation.external_user_name || conversation.external_user_id}
              </h1>
              {isGroupConversation && (
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-[1px] text-[11px] font-semibold text-foreground/80 border border-border/50">
                  Group
                </span>
              )}
            </div>
            <p className="text-[12px] text-muted-foreground">
              via {conversation.channel_account?.display_name || conversation.channel_account?.phone_number || "Channel"}
            </p>
            {phoneLabel && (
              <p className="text-[12px] text-muted-foreground">
                {phoneLabel}
              </p>
            )}
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
          onScroll={handleMessagesScroll}
          className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-3 bg-[hsl(var(--background))]"
        >
          {/* Mounted whenever the key is not held in this session, not only
              when something sealed is already on screen. Waiting for the first
              sealed message was too late in both directions: a conversation is
              private by default, so with no enrolled key in the workspace the
              engine refuses to seal and DROPS inbound messages, and a reply
              cannot be sent either. The enrolment has to be reachable before
              the first message, not after one has already been lost.

              The gate renders nothing once the key is held, so a workspace that
              is set up never sees it. */}
          {token && (
            <ReaderKeyGate
              token={token as string}
              onUnlocked={() => setMessages((prev) => [...prev])}
            />
          )}
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
            {loadingOlder && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-4 w-4 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
                Loading earlier messages…
              </div>
            )}
            {messages.map((msg) => {
              const isOutbound = msg.direction === "outbound";
              const statusLower = msg.status?.toLowerCase();
              const isFailed = isOutbound && statusLower === "error";
              const timestampText =
                msg.sent_at
                  ? new Date(msg.sent_at).toLocaleString()
                  : isFailed
                    ? "Send failed"
                    : msg.created_at
                      ? new Date(msg.created_at).toLocaleString()
                      : isOutbound
                        ? "Pending send"
                        : "Received";
              // Resolve before the media heuristic: a sealed message has an
              // empty `body`, so running the heuristic on it would label every
              // encrypted message as "Media attachment".
              const resolved = resolveMessageBody(msg);
              const text = resolved.text;
              const isMedia =
                resolved.kind === "readable" &&
                (!text ||
                  text.includes("[media message]") ||
                  text.startsWith("data:") ||
                  text.startsWith("/9j/") ||
                  text.length > 500);
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
                    {isGroupConversation && !isOutbound && (
                      <div className="mb-1 text-xs text-muted-foreground">
                        {resolveSenderName(msg)}
                      </div>
                    )}
                    {isMedia ? (
                      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground/80 text-xs font-medium">
                          📎
                        </span>
                        <div className="leading-tight">
                          <p className="font-medium text-foreground/90">Media attachment</p>
                          <p className="text-[12px] text-muted-foreground max-w-[220px] truncate">
                            {text && text.length > 10 ? `${text.slice(0, 10)}…` : text || "Unsupported media"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p
                        className={clsx(
                          "whitespace-pre-wrap",
                          resolved.kind !== "readable" && "italic text-muted-foreground"
                        )}
                      >
                        {resolved.kind === "locked" && "🔒 "}
                        {resolved.kind === "corrupt" && "⚠️ "}
                        {text}
                      </p>
                    )}
                    <div className={clsx("mt-1 text-[11px] text-muted-foreground", isOutbound ? "text-right" : "text-left")}>
                      {timestampText}
                      {isOutbound && msg.status ? (
                        <span
                          className={clsx("ml-1", msg.status === "read" && "text-sky-500")}
                          title={msg.status}
                        >
                          · {deliveryTicks(msg.status)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {aiAllowed && conversation && (
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
          {sendError && (
            <p className="mb-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {sendError}
            </p>
          )}
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

// What WhatsApp users already read at a glance. The words behind them are kept
// in the title attribute rather than dropped, because "delivered" and "read"
// are the difference between chasing a customer and waiting, and a glyph alone
// is not much use to a screen reader.
function deliveryTicks(status: string): string {
  switch (status) {
    case "read":
      return "✓✓";
    case "delivered":
      return "✓✓";
    case "sent":
      return "✓";
    case "error":
      return "⚠ not sent";
    default:
      return "· · ·";
  }
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
    const clientId = getClientMessageId(m);
    const key = clientId ? `client:${clientId}` : m.id ? `id:${m.id}` : `body:${m.direction}:${m.body}`;
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

function getClientMessageId(message: Message) {
  const payload = message.payload as { client_message_id?: string } | null;
  return payload?.client_message_id;
}
