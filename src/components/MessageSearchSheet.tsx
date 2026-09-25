"use client";

import { useEffect, useState } from "react";
import Portal from "./Portal";
import { useScrollLock } from "@/lib/useScrollLock";
import { useViewportHeight } from "@/lib/useViewportHeight";
import { isVoiceNotePath } from "@/lib/uploadChatVoice";
import { isChatVideoPath } from "@/lib/uploadChatVideo";
import { searchMessages, type MessageMediaFilter, type MessageSearchResult } from "@/lib/messageSearch";

const MEDIA_FILTERS: { key: MessageMediaFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "text", label: "Text" },
  { key: "photo", label: "Photos" },
  { key: "video", label: "Videos" },
  { key: "voice", label: "Voice" },
];

function snippetFor(m: MessageSearchResult): string {
  if (m.content) return m.content;
  if (m.media_url && isVoiceNotePath(m.media_url)) return "🎤 Voice message";
  if (m.media_url && isChatVideoPath(m.media_url)) return "📹 Video";
  if (m.media_url) return "📷 Photo";
  return "";
}

function formatResultDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
    " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function MessageSearchSheet({
  conversationId,
  onSelect,
  onClose,
}: {
  conversationId: string;
  // Passes the whole match list plus which one was tapped, so the chat view
  // can offer "next/previous match" navigation without re-running the search.
  onSelect: (results: MessageSearchResult[], index: number) => void;
  onClose: () => void;
}) {
  useScrollLock();
  useViewportHeight();
  const [keyword, setKeyword] = useState("");
  const [mediaType, setMediaType] = useState<MessageMediaFilter>("all");
  const [showDates, setShowDates] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [results, setResults] = useState<MessageSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // No filters set at all yet — don't run an unfiltered "load everything".
    if (!keyword.trim() && mediaType === "all" && !dateFrom && !dateTo) {
      setResults(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      searchMessages(conversationId, { keyword, mediaType, dateFrom, dateTo })
        .then((rows) => {
          if (!cancelled) setResults(rows);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [conversationId, keyword, mediaType, dateFrom, dateTo]);

  return (
    <Portal>
      <div
        className="fixed inset-x-0 z-[100] flex flex-col bg-surface-light dark:bg-surface-darkMuted"
        style={{ top: "var(--app-offset-top, 0px)", height: "var(--app-height, 100dvh)" }}
      >
        <div className="safe-top flex shrink-0 items-center gap-2 border-b border-black/5 px-3.5 py-3 dark:border-white/5">
          <button onClick={onClose} aria-label="Back" className="shrink-0 p-1">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <input
            autoFocus
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Search in this conversation"
            className="min-w-0 flex-1 rounded-full bg-black/5 px-4 py-2 text-sm outline-none dark:bg-white/10"
          />
          <button
            onClick={() => setShowDates((s) => !s)}
            aria-label="Date filters"
            className={`shrink-0 rounded-full p-2 ${showDates ? "bg-brand-gradient text-white" : "bg-black/5 dark:bg-white/10"}`}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="shrink-0 border-b border-black/5 px-3.5 py-2.5 dark:border-white/5">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {MEDIA_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setMediaType(f.key)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  mediaType === f.key ? "bg-brand-gradient text-white" : "bg-black/5 text-ink-muted dark:bg-white/10"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {showDates && (
            <div className="mt-2.5 flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="min-w-0 flex-1 rounded-xl2 bg-black/5 px-3 py-2 text-xs outline-none dark:bg-white/10"
              />
              <span className="text-xs text-ink-muted">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="min-w-0 flex-1 rounded-xl2 bg-black/5 px-3 py-2 text-xs outline-none dark:bg-white/10"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(""); setDateTo(""); }}
                  className="shrink-0 text-xs font-semibold text-ink-muted"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading && <p className="px-2 py-6 text-center text-sm text-ink-muted">Searching…</p>}

          {!loading && results === null && (
            <p className="px-4 py-10 text-center text-sm text-ink-muted">
              Type a keyword, or filter by media type or date, to search this conversation.
            </p>
          )}

          {!loading && results !== null && results.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-ink-muted">No messages match.</p>
          )}

          {!loading && results !== null && results.length > 0 && (
            <p className="px-3 pb-1 pt-0.5 text-xs text-ink-muted">
              {results.length} {results.length === 1 ? "match" : "matches"}
            </p>
          )}

          {!loading && results?.map((m, i) => (
            <button
              key={m.id}
              onClick={() => results && onSelect(results, i)}
              className="flex w-full flex-col gap-0.5 rounded-xl2 px-3 py-2.5 text-left transition active:bg-black/5 dark:active:bg-white/5"
            >
              <p className="truncate text-sm">{snippetFor(m)}</p>
              <p className="text-[11px] text-ink-muted">{formatResultDate(m.created_at)}</p>
            </button>
          ))}
        </div>
      </div>
    </Portal>
  );
}
