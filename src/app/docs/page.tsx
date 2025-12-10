export default function DocsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-12">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-blue-400">Docs</p>
          <h1 className="text-3xl font-semibold text-white">Developer quickstart</h1>
          <p className="text-sm text-slate-400">Use the Public API to send WhatsApp messages and fetch conversations.</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-3 text-sm">
          <p className="text-slate-300 font-semibold">Send a message</p>
          <pre className="bg-slate-950 border border-slate-800 rounded-md p-3 overflow-auto text-xs">
{`curl -X POST "https://api.connect.securifi.com.my/api/public/v1/messages/send" \\
  -H "Authorization: Bearer sc_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "60123456789",
    "message": "Hello from Securifi Connect!"
  }'`}
          </pre>
          <p className="text-slate-400 text-xs">
            Need more? Contact us at <a className="text-blue-400" href="mailto:hello@securifi.com">hello@securifi.com</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
