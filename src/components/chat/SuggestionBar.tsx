import React from "react";

type Props = {
  suggestions: string[];
  onPick: (text: string) => void;
  loading: boolean;
  onRefresh: () => void;
  error?: string | null;
};

export function SuggestionBar({ suggestions, onPick, loading, onRefresh, error }: Props) {
  if (!suggestions.length && !loading && !error) return null;

  return (
    <div className="mb-2 rounded-lg border border-slate-800 bg-slate-900/70 p-2 text-xs text-slate-200">
      <div className="flex items-center justify-between mb-2">
        <span>✨ AI Suggestions</span>
        <button
          type="button"
          onClick={onRefresh}
          className="text-sky-400 hover:text-sky-300"
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>
      {error && <p className="text-red-400 mb-2">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, idx) => (
          <button
            type="button"
            key={`${suggestion}-${idx}`}
            onClick={() => onPick(suggestion)}
            className="rounded-full bg-slate-800 px-3 py-1 text-left"
          >
            {suggestion}
          </button>
        ))}
        {loading && <span>Generating...</span>}
      </div>
    </div>
  );
}
