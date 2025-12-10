"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import {
  apiGetChannelAccountQr,
  apiGetChannelAccountSessionStatus,
} from "@/lib/api";
import { useChannelWizard } from "@/lib/channel-wizard-store";

const POLL_INTERVAL_MS = 2000;
const CONNECTED_STATUSES = new Set(["connected", "islogged", "inchat", "chatsavailable"]);

function normalizeStatus(value: string | null): string | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (CONNECTED_STATUSES.has(lower)) {
    return "connected";
  }
  return value;
}

export default function ChannelQrPage() {
  const router = useRouter();
  const { token } = useAuthStore();
  const {
    channelAccountId,
    status,
    qr,
    error,
    setStatus,
    setQr,
    setError,
    setLoading,
  } = useChannelWizard();

  useEffect(() => {
    if (!token || !channelAccountId) {
      router.replace("/app/channels");
      return;
    }

    let cancelled = false;

    const normalizeQr = (value?: string | null) => {
      if (!value) return null;
      return value.startsWith("data:image") ? value : `data:image/png;base64,${value}`;
    };

    async function poll() {
      if (!token || !channelAccountId) return;
      setLoading(true);

      try {
        const [statusRes, qrRes] = await Promise.all([
          apiGetChannelAccountSessionStatus(token, channelAccountId),
          apiGetChannelAccountQr(token, channelAccountId),
        ]);

        if (cancelled) return;

        const rawStatus = statusRes?.status || null;
        const nextStatus = normalizeStatus(rawStatus);
        setStatus(nextStatus);
        setError(null);

        if (typeof qrRes?.qr !== "undefined") {
          setQr(normalizeQr(qrRes.qr));
        }

        if (nextStatus === "connected") {
          router.replace("/app/channels/new/connected");
        } else if (nextStatus === "failed") {
          setError("WhatsApp session failed. Please restart the wizard.");
        }
      } catch (err) {
        console.error("Failed to poll QR/status", err);
        if (!cancelled) {
          setError("Unable to reach the WhatsApp engine. Retrying…");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token, channelAccountId, router, setError, setQr, setStatus, setLoading]);

  if (!channelAccountId) {
    return null;
  }

  const showRetry = status === "failed";

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
      <div>
        <h1 className="text-2xl font-semibold text-white">Connect your WhatsApp</h1>
        <p className="text-sm text-slate-400 mt-1">
          Use WhatsApp &gt; Linked Devices to scan the QR code below.
        </p>
      </div>

      {qr ? (
        <div className="p-4 rounded-lg bg-white shadow border border-slate-200">
          <Image
            src={qr}
            alt="WhatsApp QR Code"
            width={260}
            height={260}
            className="w-64 h-64"
            unoptimized
          />
        </div>
      ) : (
        <p className="text-sm text-slate-400">Waiting for QR from the engine…</p>
      )}

      <p className="text-xs text-slate-400">
        Status: <span className="font-semibold text-slate-100">{status ?? "starting"}</span>
      </p>

      {error && (
        <p className="text-xs text-red-400 max-w-sm">
          {error}
        </p>
      )}

      {showRetry && (
        <button
          onClick={() => router.replace("/app/channels/new")}
          className="inline-flex items-center rounded-md bg-red-600 hover:bg-red-500 px-4 py-2 text-sm font-medium text-white"
        >
          Restart wizard
        </button>
      )}

      <p className="text-[11px] text-slate-500 mt-4">
        Leave this tab open while linking. Once connected we&apos;ll take you to the next step.
      </p>
    </div>
  );
}
