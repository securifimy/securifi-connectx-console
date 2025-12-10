export default function ContactPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-blue-400">Contact</p>
          <h1 className="text-3xl font-semibold text-white">Talk to us</h1>
          <p className="text-sm text-slate-400">Questions about onboarding, pricing, or enterprise? We’re here to help.</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-3 text-sm">
          <p className="text-slate-300">Email</p>
          <p className="text-slate-100">support@securifi.com</p>
          <p className="text-slate-300 pt-2">Sales</p>
          <p className="text-slate-100">sales@securifi.com</p>
        </div>
      </div>
    </div>
  );
}
