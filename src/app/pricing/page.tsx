import { PLAN_DEFINITIONS } from "@/lib/plans";

const comparison = [
  {
    label: "Channels",
    values: PLAN_DEFINITIONS.map((plan) => plan.channels),
  },
  {
    label: "Messages / month",
    values: PLAN_DEFINITIONS.map((plan) => plan.messagesPerMonth),
  },
  {
    label: "API access",
    values: PLAN_DEFINITIONS.map((plan) => plan.apiAccess),
  },
  {
    label: "Webhooks",
    values: PLAN_DEFINITIONS.map((plan) => plan.webhooks),
  },
  {
    label: "Support",
    values: PLAN_DEFINITIONS.map((plan) => plan.support),
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-12">
      <div className="max-w-5xl mx-auto space-y-10">
        <div className="text-center space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-blue-400">Pricing</p>
          <h1 className="text-3xl font-semibold text-white">Simple plans, predictable pricing</h1>
          <p className="text-slate-400 text-sm">Upgrade any time. No hidden fees.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {PLAN_DEFINITIONS.map((tier) => (
            <div
              key={tier.code}
              className={`border rounded-xl p-6 space-y-3 ${
                tier.highlight ? "border-blue-500/60 bg-blue-500/10" : "border-slate-800 bg-slate-900/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">{tier.label}</h2>
                {tier.highlight && (
                  <span className="text-[10px] uppercase px-2 py-1 rounded-full bg-blue-600 text-white">Most popular</span>
                )}
              </div>
              <p className="text-2xl font-bold text-white">{tier.monthlyPriceLabel}</p>
              <p className="text-sm text-slate-300">{tier.description}</p>
              <ul className="text-sm text-slate-200 space-y-2">
                {tier.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span className="text-blue-400">•</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <a
                href={tier.ctaHref || "/signup"}
                className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium ${
                  tier.highlight
                    ? "bg-white text-slate-900 hover:bg-slate-100"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {tier.ctaLabel || "Start free trial"}
              </a>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Compare plans</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2 text-left">Feature</th>
                  <th className="py-2 text-left">Free</th>
                  <th className="py-2 text-left">Pro</th>
                  <th className="py-2 text-left">Business</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.label} className="border-b border-slate-800 text-slate-200">
                    <td className="py-2">{row.label}</td>
                    {row.values.map((value, index) => (
                      <td
                        key={`${row.label}-${PLAN_DEFINITIONS[index].code}`}
                        className={`py-2 ${PLAN_DEFINITIONS[index].highlight ? "font-semibold text-blue-100" : ""}`}
                      >
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-slate-800 p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm text-blue-100">Not sure where to start?</p>
            <h4 className="text-2xl font-semibold text-white">Start on Free, move up as usage grows</h4>
          </div>
          <a
            href="/signup"
            className="inline-flex items-center rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Start free trial
          </a>
        </div>
      </div>
    </div>
  );
}
