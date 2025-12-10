"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAuthStore } from "@/lib/auth-store";
import {
  apiGetChannelAccountQr,
  apiGetChannelAccountSessionStatus
} from "@/lib/api";

type Props = {
  channelAccountId: string;
};

export default function ConnectChannelClient({ channelAccountId }: Props) {
  const { token } = useAuthStore();
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState("offline");
  const numericId = Number(channelAccountId);

  const normalizeQr = (value?: string | null) => {
    if (!value) return null;
    return value.startsWith("data:image")
      ? value
      : `data:image/png;base64,${value}`;
  };

  useEffect(() => {
    if (!token || Number.isNaN(numericId)) return;

    let cancelled = false;

    const fetchData = async () => {
      try {
        const statusRes = await apiGetChannelAccountSessionStatus(token, numericId);
        if (!cancelled && statusRes?.status) {
          setStatus(statusRes.status);
        }
      } catch {
        if (!cancelled) {
          setStatus("offline");
        }
      }

      try {
        const qrRes = await apiGetChannelAccountQr(token, numericId);
        if (!cancelled) {
          setQr(normalizeQr(qrRes?.qr));
        }
      } catch {
        // ignore QR errors; we'll retry on next poll
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token, numericId]);

  if (Number.isNaN(numericId)) {
    return (
      <div className="p-6 text-slate-200">
        <p>Invalid channel account.</p>
      </div>
    );
  }

  return (
    <div className="p-6 text-white space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Connect WhatsApp</h1>
        <p className="text-sm text-slate-400">Status: {status}</p>
      </div>

      {qr ? (
        <Image
          src={qr}
          alt="WhatsApp QR"
          width={256}
          height={256}
          className="w-64 h-64"
          unoptimized
        />
      ) : (
        <p>Waiting for QR...</p>
      )}
    </div>
  );
}
