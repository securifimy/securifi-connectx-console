"use client";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center px-6 py-16">
      <div className="max-w-3xl w-full space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Terms of Service</h1>
        <p className="text-sm text-[var(--text2)]">
          Our full Terms of Service are coming soon. For now, please contact support if you have any
          questions about your use of Securifi Connect.
        </p>
        <p className="text-sm text-[var(--text2)]">support@securifi.com</p>
      </div>
    </div>
  );
}
