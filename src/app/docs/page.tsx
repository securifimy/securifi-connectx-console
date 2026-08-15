import type { ReactNode } from "react";

const baseUrls = [
  { label: "Production", value: "https://api.connect.securifi.com.my" },
  { label: "Development", value: "https://api.connect.dev.securifi.com.my" },
];

const scopes = [
  "messages:send",
  "messages:read",
  "conversations:read",
];

const sendExample = `curl -X POST "https://api.connect.securifi.com.my/api/public/v1/messages/send" \\
  -H "Authorization: Bearer sc_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "60123456789",
    "message": "Hello from Securifi Connect"
  }'`;

const createKeyExample = `curl -X POST "https://api.connect.securifi.com.my/api/v1/channel_accounts/<channel_account_id>/channel_api_keys" \\
  -H "Authorization: Bearer <workspace-jwt>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "label": "ERP Integration",
    "scopes": ["messages:send", "conversations:read", "messages:read"]
  }'`;

const queuedResponse = `{
  "status": "queued",
  "message_id": 4821,
  "conversation_id": 991
}`;

const readMessagesExample = `curl "https://api.connect.securifi.com.my/api/public/v1/conversations/991/messages" \\
  -H "Authorization: Bearer sc_live_..."`;

const errorExamples = [
  { code: "401", body: '{ "error": "Missing API key" }' },
  { code: "401", body: '{ "error": "Invalid API key" }' },
  { code: "403", body: '{ "error": "Missing required scope messages:send" }' },
  { code: "422", body: '{ "error": "Missing to or message" }' },
  { code: "429", body: '{ "error": "Rate limit exceeded" }' },
];

const updateWebhookExample = `curl -X PUT "https://api.connect.securifi.com.my/api/v1/channel_accounts/<channel_account_id>" \\
  -H "Authorization: Bearer <workspace-jwt>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "channel_account": {
      "webhook_url": "https://example.com/webhooks/securifi",
      "webhook_events": ["inbound_message", "status_update"]
    }
  }'`;

const webhookInboundExample = `{
  "id": 882,
  "conversation_id": 991,
  "channel_id": 14,
  "direction": "inbound",
  "sender_type": "external",
  "content_type": "text",
  "body": "",
  "encrypted": true,
  "sealed_body": {
    "v": 1,
    "ctx": "message-body",
    "n": "<base64 nonce>",
    "ct": "<base64 ciphertext>",
    "recipients": [
      { "kid": "...", "epk": "...", "wn": "...", "k": "..." }
    ]
  },
  "payload": {
    "from": "182691014144082@lid",
    "from_me": false,
    "peer_name": "Eman",
    "timestamp": 1773925801,
    "message_id": "3AC95C1FDFAD0E2A1B44",
    "external_user_id": "60123456789@s.whatsapp.net",
    "channel_account_id": 14,
    "tenant_slug": "acme"
  },
  "status": "sent",
  "stored": true,
  "event": "inbound_message",
  "channel_account_id": 14,
  "tenant_slug": "acme"
}`;

const sealedSendExample = `curl -X POST "https://api.connect.securifi.com.my/api/public/v1/messages/send" \\
  -H "Authorization: Bearer sc_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "60123456789",
    "sealed_message": {
      "v": 1,
      "ctx": "message-transmit",
      "n": "<base64 nonce>",
      "ct": "<base64 ciphertext>",
      "recipients": [ { "kid": "...", "epk": "...", "wn": "...", "k": "..." } ]
    }
  }'`;

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs leading-6 text-slate-200">
      {children}
    </pre>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {description ? <p className="text-sm text-slate-400">{description}</p> : null}
      </div>
      <div className="mt-5 space-y-4 text-sm text-slate-200">{children}</div>
    </section>
  );
}

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-blue-400">Docs</p>
          <h1 className="text-3xl font-semibold text-white">WhatsApp public API</h1>
          <p className="max-w-3xl text-sm text-slate-400">
            Use the public API when another app needs to send WhatsApp messages through a specific
            Securifi Connect channel account. Each API key belongs to one channel account, so the
            key itself decides which WhatsApp session sends the message.
          </p>
          <p className="max-w-3xl text-sm text-slate-500">
            Repo artifacts: <code className="font-mono text-slate-300">api/docs/openapi-public-v1.yaml</code>,
            {" "}<code className="font-mono text-slate-300">api/docs/postman-public-api.postman_collection.json</code>,
            {" "}<code className="font-mono text-slate-300">api/docs/webhooks.md</code>.
          </p>
        </div>

        <Section title="Base URLs" description="Choose the host that matches your environment.">
          <div className="grid gap-3 md:grid-cols-2">
            {baseUrls.map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                <p className="mt-2 font-mono text-sm text-slate-200">{item.value}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="What You Need"
          description="External apps can only send after the channel account and API key are ready."
        >
          <ul className="space-y-2 text-sm text-slate-300">
            <li>A connected WhatsApp channel account.</li>
            <li>A channel API key created from the channel&apos;s Developer page.</li>
            <li>The <code className="font-mono text-slate-100">messages:send</code> scope.</li>
          </ul>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Common scopes</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {scopes.map((scope) => (
                <span
                  key={scope}
                  className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 font-mono text-xs text-slate-200"
                >
                  {scope}
                </span>
              ))}
            </div>
          </div>
        </Section>

        <Section
          title="Create An API Key"
          description="You can create the key in the console Developer page or provision it with the workspace API."
        >
          <p className="text-slate-300">
            Console path: open the channel account, then go to <span className="font-medium text-white">Developer</span>
            {" "}and create a new API key. If you need automation, use the authenticated workspace API below.
          </p>
          <CodeBlock>{createKeyExample}</CodeBlock>
          <p className="text-sm text-slate-400">
            Store the raw <code className="font-mono text-slate-100">sc_live_...</code> value when it is returned.
            That raw key is only shown at creation time and is what external apps send as a Bearer token.
          </p>
        </Section>

        <Section
          title="Send A Message"
          description="The send endpoint accepts the request into the outbound queue for the channel tied to your API key."
        >
          <div className="space-y-2 text-sm text-slate-300">
            <p>
              Endpoint: <code className="font-mono text-slate-100">POST /api/public/v1/messages/send</code>
            </p>
            <p>
              Send the destination in international format, preferably digits only, for example{" "}
              <code className="font-mono text-slate-100">60123456789</code>.
            </p>
          </div>
          <CodeBlock>{sendExample}</CodeBlock>
          <div>
            <p className="mb-2 text-sm font-medium text-white">Successful response</p>
            <CodeBlock>{queuedResponse}</CodeBlock>
          </div>
          <p className="text-sm text-slate-400">
            <code className="font-mono text-slate-100">queued</code> means Securifi Connect accepted the request.
            Final WhatsApp delivery still happens asynchronously through the engine and session state.
          </p>
        </Section>

        <Section
          title="Read Delivery State"
          description="Use the public read endpoints when you want to poll conversations and messages after queueing."
        >
          <div className="space-y-2 text-sm text-slate-300">
            <p>
              <code className="font-mono text-slate-100">GET /api/public/v1/conversations</code> requires{" "}
              <code className="font-mono text-slate-100">conversations:read</code>.
            </p>
            <p>
              <code className="font-mono text-slate-100">GET /api/public/v1/conversations/:conversation_id/messages</code>{" "}
              requires <code className="font-mono text-slate-100">messages:read</code>.
            </p>
          </div>
          <CodeBlock>{readMessagesExample}</CodeBlock>
          <p className="text-sm text-slate-400">
            Message objects expose a derived status of{" "}
            <code className="font-mono text-slate-100">sending</code>,{" "}
            <code className="font-mono text-slate-100">sent</code>,{" "}
            <code className="font-mono text-slate-100">delivered</code>,{" "}
            <code className="font-mono text-slate-100">read</code>, or{" "}
            <code className="font-mono text-slate-100">error</code>. When the status is{" "}
            <code className="font-mono text-slate-100">error</code>, inspect{" "}
            <code className="font-mono text-slate-100">error_message</code>.
          </p>
        </Section>

        <Section
          title="Message Privacy"
          description="Conversations are private by default, so message bodies you read back are encrypted."
        >
          <div className="space-y-2 text-sm text-slate-300">
            <p>
              A workspace holds reader keys that Securifi Connect cannot open. Message bodies are
              sealed to those keys before they are stored, so what you read back through the API is
              an envelope rather than words.
            </p>
            <p>
              On every message object, branch on{" "}
              <code className="font-mono text-slate-100">encrypted</code> — not on{" "}
              <code className="font-mono text-slate-100">body</code> being blank, because a genuinely
              empty message is blank too. When{" "}
              <code className="font-mono text-slate-100">encrypted</code> is true,{" "}
              <code className="font-mono text-slate-100">body</code> is an empty string and the
              content is in <code className="font-mono text-slate-100">sealed_body</code>, openable
              only with the private half of a key you registered.
            </p>
            <p>
              <code className="font-mono text-slate-100">POST /api/public/v1/keys</code> registers a
              reader key for your integration, so sealed messages are readable by your app.{" "}
              <code className="font-mono text-slate-100">GET /api/public/v1/encryption_key</code>{" "}
              returns the engine public key you seal outbound messages to.
            </p>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-white">Sending words we cannot read</p>
            <CodeBlock>{sealedSendExample}</CodeBlock>
          </div>
          <p className="text-sm text-slate-400">
            Sending plain <code className="font-mono text-slate-100">message</code> instead is still
            supported, but it marks that conversation{" "}
            <code className="font-mono text-slate-100">server_readable</code>, because we have stored
            words we can read. Add <code className="font-mono text-slate-100">&quot;store&quot;: false</code>{" "}
            to send without keeping any copy at all — the message is delivered and nothing of its
            content remains.
          </p>
        </Section>

        <Section
          title="Common Errors"
          description="These are the main API-level failures returned directly by the public endpoints."
        >
          <div className="grid gap-3">
            {errorExamples.map((item) => (
              <div key={`${item.code}-${item.body}`} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">HTTP {item.code}</p>
                <p className="mt-3 font-mono text-xs text-slate-200">{item.body}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Usage Headers"
          description="Public API responses also include billing and quota context in response headers."
        >
          <ul className="space-y-2 font-mono text-xs text-slate-300">
            <li>X-Billing-Plan</li>
            <li>X-Billing-Remaining-Messages</li>
            <li>X-Billing-Remaining-API-Calls</li>
          </ul>
        </Section>

        <Section
          title="Webhooks"
          description="Use webhooks when your app should receive inbound or delivery events without polling."
        >
          <div className="space-y-2 text-sm text-slate-300">
            <p>Supported events: <code className="font-mono text-slate-100">inbound_message</code> and <code className="font-mono text-slate-100">status_update</code>.</p>
            <p>Deliveries use JSON `POST` requests to the channel account&apos;s configured webhook URL. Any `2xx` response is treated as success.</p>
            <p>If the server has <code className="font-mono text-slate-100">WEBHOOK_SIGNATURE_SECRET</code> configured, each request also includes <code className="font-mono text-slate-100">X-SC-Signature</code>.</p>
          </div>
          <CodeBlock>{updateWebhookExample}</CodeBlock>
          <div>
            <p className="mb-2 text-sm font-medium text-white">Inbound webhook example</p>
            <CodeBlock>{webhookInboundExample}</CodeBlock>
          </div>
          <p className="text-sm text-slate-400">
            One contact can reach you under two addresses:{" "}
            <code className="font-mono text-slate-100">payload.from</code> is whatever WhatsApp used,
            which may be a LID such as{" "}
            <code className="font-mono text-slate-100">182691014144082@lid</code> and contains no
            phone number, while{" "}
            <code className="font-mono text-slate-100">payload.external_user_id</code> is the same
            person&apos;s number and is what the conversation is keyed on. Match contacts on{" "}
            <code className="font-mono text-slate-100">external_user_id</code>; matching on{" "}
            <code className="font-mono text-slate-100">from</code> splits one person into two.
          </p>
          <p className="text-sm text-slate-400">
            Failed webhook deliveries are retried automatically with backoff and can also be replayed from the channel Developer page.
          </p>
        </Section>
      </div>
    </div>
  );
}
