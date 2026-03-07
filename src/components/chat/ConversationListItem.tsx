"use client";

import clsx from "clsx";
import { formatPhoneFromExternalId } from "@/lib/chat";

export type ConversationListItemProps = {
  conversation: {
    id: number;
    external_user_id: string;
    external_user_name?: string | null;
    last_message_body?: string | null;
    status?: string | null;
    last_message_at?: string | null;
    kind?: string | null;
    channel_account?: {
      display_name?: string | null;
      phone_number?: string | null;
    };
  };
  isActive?: boolean;
  onClick?: () => void;
};

export function ConversationListItem({ conversation, isActive, onClick }: ConversationListItemProps) {
  const title = conversation.external_user_name || conversation.external_user_id;
  const channelLabel =
    conversation.channel_account?.display_name ||
    conversation.channel_account?.phone_number ||
    "Channel";
  const preview = buildPreview(conversation.last_message_body);
  const time = conversation.last_message_at
    ? new Date(conversation.last_message_at).toLocaleString()
    : "";
  const status = (conversation.status || "open").toLowerCase();
  const isGroup = conversation.kind === "group" || conversation.external_user_id?.endsWith("@g.us");
  const phoneLabel = formatPhoneFromExternalId(conversation.external_user_id);

  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full text-left rounded-xl border border-border/60 bg-[hsl(var(--card))] p-4 shadow-sm hover:shadow-md hover:-translate-y-[1px] transition flex items-start justify-between gap-3",
        isActive && "border-primary bg-primary/5 shadow-md ring-1 ring-primary/15"
      )}
    >
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-[15px] font-semibold text-foreground truncate">{title}</p>
          {isGroup && (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-[1px] text-[10px] font-semibold text-foreground/80 border border-border/50">
              Group
            </span>
          )}
        </div>
        <p className="text-[12px] text-muted-foreground truncate">
          via {channelLabel}
          {phoneLabel ? ` · ${phoneLabel}` : ""}
        </p>
        <p className="text-[12px] text-muted-foreground truncate">{preview}</p>
      </div>
      <div className="text-right space-y-2 flex-shrink-0">
        <StatusPill status={status} />
        <p className="text-[11px] text-muted-foreground whitespace-nowrap">{time}</p>
      </div>
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const open = status === "open";
  const closed = status === "closed";
  let classes =
    "inline-flex items-center rounded-full px-3 py-[2px] text-[11px] font-medium bg-[#E0ECFF] text-brand-blue";
  let label = status.toUpperCase();

  if (open) {
    classes = "inline-flex items-center rounded-full px-3 py-[2px] text-[11px] font-medium bg-[#FFF4CC] text-[#C27C00]";
    label = "OPEN";
  } else if (closed) {
    classes = "inline-flex items-center rounded-full px-3 py-[2px] text-[11px] font-medium bg-[#DCFCE7] text-[#166534]";
    label = "CLOSED";
  }

  return <span className={classes}>{label}</span>;
}

function buildPreview(body?: string | null) {
  if (!body) return "No messages yet.";
  const trimmed = body.trim();
  const looksBase64 = /^data:/i.test(trimmed) || /^[A-Za-z0-9/+]{80,}={0,2}$/.test(trimmed);
  const text = looksBase64 ? "[media message]" : trimmed;
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}
