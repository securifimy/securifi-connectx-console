"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { apiGetChannelAccounts } from "@/lib/api";
import { apiSendNewChat } from "@/lib/chat";

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
      const data = await apiGetChannelAccounts(authToken);
      setAccounts(data);
      if (data.length > 0) {
        setChannelAccountId(data[0].id);
      }
    }
    loadAccounts();
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
    <div className="flex-1 flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-4 w-full max-w-md">
        <h1 className="text-lg font-semibold text-white">Start New Chat</h1>
        <div className="space-y-1">
          <label className="text-sm text-slate-300">Phone Number</label>
          <input
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
            placeholder="60123456789"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-300">Channel Account</label>
          <select
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
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
        <div className="space-y-1">
          <label className="text-sm text-slate-300">First Message</label>
          <textarea
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
            rows={3}
            placeholder="Hello!"
            value={initialMessage}
            onChange={(e) => setInitialMessage(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-md bg-sky-500 hover:bg-sky-600 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Creating..." : "Start Chat"}
        </button>
      </form>
    </div>
  );
}
