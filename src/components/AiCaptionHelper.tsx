"use client";

import { useState } from "react";

export default function AiCaptionHelper({ onPick }: { onPick: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "caption", topic: topic.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const lines = String(data.reply ?? "")
        .split("\n")
        .map((l) => l.replace(/^[\d.\-•\s]+/, "").trim())
        .filter(Boolean)
        .slice(0, 3);
      setSuggestions(lines);
    } catch {
      setError("Couldn't generate captions. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 rounded-full bg-black/5 px-3 py-1.5 text-xs font-medium text-ink-muted dark:bg-white/10"
      >
        ✨ AI caption
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-xl2 bg-black/5 p-3 dark:bg-white/10">
      <div className="flex gap-2">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="What's this post about?"
          className="flex-1 rounded-full bg-white px-3 py-1.5 text-xs outline-none dark:bg-black/30"
        />
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="shrink-0 rounded-full bg-brand-gradient px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {loading ? "…" : "Generate"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      {suggestions.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {suggestions.map((s, i) => (
            <button
              type="button"
              key={i}
              onClick={() => {
                onPick(s);
                setOpen(false);
                setSuggestions([]);
              }}
              className="block w-full rounded-lg bg-white px-3 py-2 text-left text-xs dark:bg-black/30"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setSuggestions([]);
        }}
        className="mt-2 text-xs text-ink-muted"
      >
        Cancel
      </button>
    </div>
  );
}
