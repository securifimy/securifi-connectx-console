"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChannelConnectExperience } from "@/components/channels/ChannelConnectExperience";
import { useChannelWizard } from "@/lib/channel-wizard-store";

export default function ChannelQrPage() {
  const router = useRouter();
  const { channelAccountId } = useChannelWizard();

  useEffect(() => {
    if (!channelAccountId) {
      router.replace("/app/channels");
    }
  }, [channelAccountId, router]);

  if (!channelAccountId) {
    return null;
  }

  return (
    <ChannelConnectExperience
      channelAccountId={channelAccountId}
      title="Link WhatsApp"
      subtitle="Enter the code on the phone you are linking, and keep this page open while the workspace waits for a fully send-ready session."
      contextLabel="New channel setup"
      backHref="/app/channels"
      backLabel="Back to channels"
      completeHref="/app/channels/new/connected"
      connectedMessage="WhatsApp is linked. Opening the channel setup screen."
    />
  );
}
