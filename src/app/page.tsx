import Image from "next/image";

const features = [
  { title: "Multi-agent WhatsApp inbox", desc: "Collaborate in one shared inbox with assignments and statuses." },
  { title: "AI auto-replies", desc: "Suggest quick responses from recent conversation context." },
  { title: "Unlimited conversations", desc: "No per-thread fees. Keep history and context available." },
  { title: "Developer API", desc: "Send/receive WhatsApp messages via REST with per-channel API keys." },
  { title: "Webhook integrations", desc: "Deliver inbound events and message status to your systems." },
];

export default function HomePage() {
  return (
    <div className="bg-slate-950 text-slate-100">
      <header className="max-w-6xl mx-auto px-6 py-14 grid gap-10 lg:grid-cols-2">
        <div className="space-y-5">
          <p className="text-xs uppercase tracking-[0.2em] text-blue-400">Securifi Connect</p>
          <h1 className="text-4xl lg:text-5xl font-semibold text-white leading-tight">
            WhatsApp inbox for fast-moving teams
          </h1>
          <p className="text-lg text-slate-300">
            Connect your WhatsApp number, collaborate with your team, and automate conversations with webhooks and AI.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="/signup"
              className="inline-flex items-center rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Start free trial
            </a>
            <a
              href="/pricing"
              className="inline-flex items-center rounded-md border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200 hover:border-slate-500"
            >
              View pricing
            </a>
          </div>
          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
            <p className="font-semibold text-white mb-1">Developer friendly</p>
            <p>Per-channel API keys, webhooks, ActionCable streaming, and REST for messages and conversations.</p>
          </div>
        </div>
        <div className="flex items-center justify-center">
          <div className="w-full max-w-md aspect-square rounded-2xl bg-gradient-to-br from-blue-500/10 via-slate-800 to-slate-900 border border-slate-800 flex items-center justify-center">
            <div className="text-center space-y-3 px-6">
              <p className="text-sm text-slate-300">QR onboarding</p>
              <div className="rounded-lg bg-slate-900 border border-slate-800 p-6">
                <Image src="/logo.png" alt="Securifi Connect" width={160} height={160} className="mx-auto h-40 w-40 object-contain" priority />
              </div>
              <p className="text-xs text-slate-500">Scan with WhatsApp → Linked devices</p>
            </div>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-12 space-y-6">
        <h2 className="text-2xl font-semibold text-white">Features built for operators & developers</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/40" />
              <p className="text-lg font-semibold text-white">{f.title}</p>
              <p className="text-sm text-slate-300">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12 space-y-4">
        <h3 className="text-xl font-semibold text-white">What teams are saying</h3>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-200 space-y-2">
          <p className="italic text-slate-300">“Securifi Connect let us move support onto WhatsApp in a weekend.”</p>
          <p className="text-slate-500 text-xs">— Ops Lead, Commerce</p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-14">
        <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-slate-800 p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm text-blue-100">Ready to launch?</p>
            <h4 className="text-2xl font-semibold text-white">Start your free trial today</h4>
          </div>
          <a
            href="/signup"
            className="inline-flex items-center rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Start free trial
          </a>
        </div>
      </section>
    </div>
  );
}
