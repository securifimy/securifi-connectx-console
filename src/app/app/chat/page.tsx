"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { apiGetConversations } from "@/lib/api";
import { getCable } from "@/lib/cable";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { ConversationListItem } from "@/components/chat/ConversationListItem";

interface Conversation {
  id: number;
  external_user_id: string;
  external_user_name: string;
  status: string;
  last_message_at?: string | null;
  last_message_body?: string | null;
  channel_account?: {
    id: number;
    display_name?: string;
    phone_number?: string | null;
  };
  last_direction?: string | null;
}

function isUnauthorized(error: unknown): error is { status: number } {
  return Boolean(
    error &&
    typeof error === "object" &&
    "status" in error &&
    (error as { status?: number }).status === 401
  );
}

function isBroadcast(conv: Conversation) {
  return conv.external_user_id === "status@broadcast";
}

function hasConsoleOutbound(conv: Conversation) {
  // heuristic: if last_direction is outbound, assume console sent at least once
  return conv.last_direction === "outbound";
}

export default function ConversationsListPage() {
  const router = useRouter();
  const { token, tenant, clearAuth } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hideHandsetOnly, setHideHandsetOnly] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    const tenantId = tenant?.id;
    if (!token || typeof tenantId !== "number") return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiGetConversations(token, tenantId, { limit: 20 });
      const convs: Conversation[] = (Array.isArray(data) ? data : data.conversations) as Conversation[];
      const cursor = Array.isArray(data) ? null : data.nextCursor;
      const filtered = convs
        .filter((c: Conversation) => !isBroadcast(c))
        .filter((c: Conversation) => !hideHandsetOnly || hasConsoleOutbound(c));
      setConversations(sortConversations(filtered));
      setNextCursor(cursor ?? null);
    } catch (err) {
      console.error("Failed to load conversations", err);
      if (isUnauthorized(err)) {
        setError("Session expired. Please sign in again.");
        clearAuth();
        router.replace("/login");
      } else {
        setError("Failed to load conversations. Please refresh.");
      }
      return;
    } finally {
      setLoading(false);
    }
  }, [token, tenant?.id, clearAuth, router, hideHandsetOnly]);

  useEffect(() => {
    load().catch((err) => {
      console.error("Initial conversations fetch failed", err);
    });
    if (!token || !tenant?.id) return;
    const consumer = getCable(token);
    const subscription = consumer.subscriptions.create(
      { channel: "ConversationListChannel" },
      {
        received: (data: unknown) => {
          const message = data as Conversation;
          if (isBroadcast(message)) return;
          setConversations((prev) => {
            const next = upsertConversation(prev, message);
            return hideHandsetOnly ? next.filter((c) => hasConsoleOutbound(c)) : next;
          });
        },
      }
    );
    const interval = setInterval(load, 10000);
    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [token, tenant?.id, load, hideHandsetOnly]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && nextCursor && !loadingMore && !loading) {
          const tenantId = tenant?.id;
          if (!token || typeof tenantId !== "number") return;
          setLoadingMore(true);
          apiGetConversations(token, tenantId, { cursor: nextCursor, limit: 20 })
            .then((data) => {
              const convs: Conversation[] = (Array.isArray(data) ? data : data.conversations) as Conversation[];
              const cursor = Array.isArray(data) ? null : data.nextCursor;
              const filtered = convs
                .filter((c: Conversation) => !isBroadcast(c))
                .filter((c: Conversation) => !hideHandsetOnly || hasConsoleOutbound(c));
              setConversations((prev) => sortConversations([...prev, ...filtered]));
              setNextCursor(cursor ?? null);
            })
            .catch((err) => {
              console.error("Failed to load more conversations", err);
              setError("Unable to load more conversations. Tap to retry.");
            })
            .finally(() => setLoadingMore(false));
        }
      },
      { threshold: 1.0 }
    );

    const node = sentinelRef.current;
    if (node) observer.observe(node);
    return () => {
      if (node) observer.unobserve(node);
      observer.disconnect();
    };
  }, [nextCursor, loadingMore, loading, token, tenant?.id, hideHandsetOnly]);

  return (
    <WorkspaceShell activeNav="inbox" layout="default">
      <div className="max-w-5xl h-[calc(100vh-160px)] flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[20px] font-semibold text-foreground">Conversations</h2>
            <p className="text-sm text-muted-foreground">Manage all chats in one place.</p>
          </div>
          <button
            onClick={() => router.push("/app/chat/new")}
            className="inline-flex items-center rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-[hsl(var(--primary-dark))]"
          >
            + New Chat
          </button>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={hideHandsetOnly}
              onChange={(e) => setHideHandsetOnly(e.target.checked)}
            />
            Hide handset-only threads
          </label>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto pr-1 pb-16">
          {loading && conversations.length === 0
            ? Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-20 rounded-xl border border-border/60 bg-[hsl(var(--muted))] animate-pulse"
                />
              ))
            : conversations.map((conv) => (
                <ConversationListItem
                  key={conv.id}
                  conversation={conv}
                  isActive={false}
                  onClick={() => router.push(`/app/chat/${conv.id}`)}
                />
              ))}
          {loadingMore && (
            <div className="flex items-center justify-center text-muted-foreground text-sm py-3">
              <div className="h-4 w-4 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin mr-2" />
              Loading more…
            </div>
          )}
          {conversations.length === 0 && !loading && (
            <div className="text-center rounded-xl border border-border/60 bg-[hsl(var(--card))] p-8">
              <div className="text-[16px] font-medium text-foreground">No conversations yet</div>
              <p className="text-[13px] text-muted-foreground mt-1">Start a new chat to begin messaging.</p>
            </div>
          )}
          <div ref={sentinelRef} className="h-6" />
        </div>
      </div>
    </WorkspaceShell>
  );
}

function sortConversations(list: Conversation[]) {
  return [...list].sort((a, b) => {
    const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return bTime - aTime;
  });
}

function upsertConversation(list: Conversation[], incoming: Conversation) {
  const next = list.slice();
  const idx = next.findIndex((item) => item.id === incoming.id);
  if (idx >= 0) {
    next[idx] = { ...next[idx], ...incoming };
    return sortConversations(next);
  }
  return sortConversations([incoming, ...next]);
}
