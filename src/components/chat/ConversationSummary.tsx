import React from "react";

type Props = {
  summary?: string | null;
  intent?: string | null;
  sentiment?: string | null;
  spamScore?: number | null;
  tags?: string[] | null;
  loading?: boolean;
  onRefresh?: () => void;
  error?: string | null;
};

export function ConversationSummary({
  summary,
  intent,
  sentiment,
  spamScore,
  tags,
  loading,
  onRefresh,
  error,
}: Props) {
  return (
    <div className="mb-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm">
      <div className="flex items-center justify-between mb-1">
        <p className="font-medium">🧠 AI Summary</p>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="text-xs text-sky-400 hover:text-sky-300"
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        )}
      </div>
      <p className="text-slate-200 mb-2">
        {summary || (loading ? "Analyzing conversation..." : "Not analyzed yet.")}
      </p>
      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
      <div className="flex flex-wrap gap-1 text-xs text-slate-200">
        {intent && <Tag label={`Intent: ${intent}`} />}
        {sentiment && <Tag label={`Sentiment: ${sentiment}`} />}
        {typeof spamScore === "number" && <Tag label={`Spam: ${(spamScore * 100).toFixed(0)}%`} />}
        {tags?.map((tag) => (
          <Tag key={tag} label={`#${tag}`} />
        ))}
      </div>
    </div>
  );
}

const Tag = ({ label }: { label: string }) => (
  <span className="rounded-full bg-slate-800 px-2 py-0.5">{label}</span>
);
