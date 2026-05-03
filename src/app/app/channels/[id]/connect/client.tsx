"use client";

import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { ChannelConnectExperience } from "@/components/channels/ChannelConnectExperience";

type Props = {
  channelAccountId: string;
};

export default function ConnectChannelClient({ channelAccountId }: Props) {
  const numericId = Number(channelAccountId);

  if (Number.isNaN(numericId)) {
    return (
      <WorkspaceShell
        activeNav="channels"
        header={{
          title: "Reconnect WhatsApp channel",
          subtitle: "Link this channel again without leaving the workspace.",
        }}
      >
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Invalid WhatsApp channel.
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <ChannelConnectExperience
      channelAccountId={numericId}
      title="Reconnect WhatsApp channel"
      subtitle="Link this channel again without leaving the workspace. We will keep the session in connecting until the engine confirms it is ready to send."
      contextLabel="Reconnect session"
      backHref={`/app/channels/${numericId}`}
      backLabel="Back to channel"
      completeHref={`/app/channels/${numericId}`}
      connectedMessage="WhatsApp is linked and healthy. Returning you to the channel dashboard."
      startOnMount
    />
  );
}
