import ConnectChannelClient from "./client";

type PageParams = { id: string };

type PageProps = {
  params: PageParams | Promise<PageParams>;
};

export default async function ConnectChannelPage({ params }: PageProps) {
  const resolved = await Promise.resolve(params);
  return <ConnectChannelClient channelAccountId={resolved.id} />;
}
