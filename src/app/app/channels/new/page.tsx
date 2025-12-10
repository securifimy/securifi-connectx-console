"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { apiCreateChannelAccount, apiStartChannelAccountSession } from "@/lib/api";
import { useChannelWizard } from "@/lib/channel-wizard-store";

export default function ChannelCreatePage() {
  const router = useRouter();
  const { token } = useAuthStore();
  const {
    setChannelAccountId,
    setStatus,
    setQr,
    setLoading,
    setError,
    reset,
    isLoading,
    error,
  } = useChannelWizard();

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }
    const authToken = token as string;

    let cancelled = false;

    async function createChannel() {
      reset();
      setLoading(true);
        setError(null);

        try {
          const result = await apiCreateChannelAccount(authToken, {
            kind: "whatsapp_unofficial",
            display_name: "New WhatsApp Account",
          });

        if (!cancelled && result?.id) {
          setChannelAccountId(result.id);
          setStatus(result.status || "pending");
          setQr(null);

            await apiStartChannelAccountSession(authToken, result.id);
            if (!cancelled) {
              router.replace("/app/channels/new/qr");
            }
        }
      } catch (err) {
        console.error("Failed to create channel account", err);
        if (!cancelled) {
          setError("Failed to create WhatsApp channel. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    createChannel();

    return () => {
      cancelled = true;
    };
  }, [
    token,
    router,
    reset,
    setChannelAccountId,
    setStatus,
    setQr,
    setLoading,
    setError,
  ]);

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="h-10 w-10 rounded-full border-2 border-slate-600 border-t-white animate-spin mx-auto" />
        <h1 className="text-lg font-semibold text-white">Creating your WhatsApp channel…</h1>
        <p className="text-sm text-slate-400">This only takes a moment.</p>
        {isLoading && (
          <p className="text-xs text-slate-500">Initialising WhatsApp session…</p>
        )}
        {error && (
          <p className="text-xs text-red-400">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
