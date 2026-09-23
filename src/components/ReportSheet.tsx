"use client";

import { useState } from "react";
import Portal from "./Portal";
import { useScrollLock } from "@/lib/useScrollLock";
import { useViewportHeight } from "@/lib/useViewportHeight";
import { REPORT_CATEGORIES } from "@/lib/reports";
import { getErrorMessage } from "@/lib/errorMessage";

// One reusable "Report" bottom sheet for posts, comments, stories and profiles.
// The caller decides what a report means (see lib/reports.ts submitReport).
export default function ReportSheet({
  title,
  onSubmit,
  onClose,
}: {
  title: string;
  onSubmit: (category: string, details: string) => Promise<void>;
  onClose: () => void;
}) {
  useScrollLock();
  useViewportHeight();
  const [category, setCategory] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!category || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSubmit(category, details);
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  // Portals still bubble React events to their React parents. Stop them here so
  // a story viewer / card underneath doesn't react to taps inside the sheet.
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return (
    <Portal>
      <div
        className="fixed inset-x-0 z-[100] flex items-end justify-center bg-black/50"
        style={{ top: "var(--app-offset-top, 0px)", height: "var(--app-height, 100dvh)" }}
        onClick={onClose}
        onPointerDown={stop}
        onPointerUp={stop}
        onTouchStart={stop}
        onTouchEnd={stop}
      >
        <div
          className="safe-bottom w-full max-w-lg overflow-y-auto rounded-t-2xl glass-card p-4"
          style={{ maxHeight: "calc(var(--app-height, 100dvh) * 0.85)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {done ? (
            <div className="py-4 text-center">
              <p className="text-base font-bold">Thanks for letting us know</p>
              <p className="mt-1.5 text-sm text-ink-muted">
                Our team will review this report. You can also block the account so you no longer see their content.
              </p>
              <button
                onClick={onClose}
                className="mt-5 w-full rounded-full bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <p className="text-base font-bold">{title}</p>
              <p className="mt-1 text-xs text-ink-muted">Why are you reporting this?</p>

              <div className="mt-3 flex flex-col gap-1.5">
                {REPORT_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`flex items-center justify-between rounded-xl2 px-3.5 py-2.5 text-left text-sm ${
                      category === c
                        ? "bg-brand-gradient font-semibold text-white"
                        : "bg-black/5 dark:bg-white/10"
                    }`}
                  >
                    {c}
                    {category === c && <span>✓</span>}
                  </button>
                ))}
              </div>

              {category && (
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  placeholder="Anything else we should know? (optional)"
                  className="mt-3 w-full resize-none rounded-xl2 bg-black/5 px-3.5 py-2.5 text-sm outline-none dark:bg-white/10"
                />
              )}

              {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

              <button
                onClick={submit}
                disabled={!category || sending}
                className="mt-3 w-full rounded-full bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {sending ? "Sending…" : "Submit report"}
              </button>
              <button onClick={onClose} className="mt-2 w-full py-2 text-sm font-medium text-ink-muted">
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </Portal>
  );
}
