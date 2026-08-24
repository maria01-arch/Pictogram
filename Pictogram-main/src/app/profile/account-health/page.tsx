"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { AccountStrike } from "@/types/database";

const STATUS_STYLES: Record<AccountStrike["status"], string> = {
  active: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  appealed: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  overturned: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  upheld: "bg-red-500/15 text-red-600 dark:text-red-400",
};

export default function AccountHealthPage() {
  const [strikes, setStrikes] = useState<AccountStrike[]>([]);
  const [loading, setLoading] = useState(true);
  const [appealDraft, setAppealDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    loadStrikes();
  }, []);

  async function loadStrikes() {
    const { data, error } = await supabase
      .from("account_strikes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) console.error("Failed to load strikes:", error.message);
    setStrikes(data ?? []);
    setLoading(false);
  }

  async function submitAppeal(strikeId: string) {
    const text = appealDraft[strikeId]?.trim();
    if (!text) return;

    const { error } = await supabase
      .from("account_strikes")
      .update({
        status: "appealed",
        appeal_text: text,
        appeal_submitted_at: new Date().toISOString(),
      })
      .eq("id", strikeId);

    if (error) {
      console.error("Failed to submit appeal:", error.message);
      return;
    }
    loadStrikes();
  }

  const activeCount = strikes.filter((s) => s.status === "active" || s.status === "upheld").length;

  return (
    <div className="px-4 pb-8 pt-4">
      <h2 className="text-lg font-bold">Account Health</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Every strike against your account, in full — no silent restrictions, ever.
      </p>

      <div className="mt-4 rounded-xl2 glass-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-muted">Standing</span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              activeCount === 0
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
            }`}
          >
            {activeCount === 0 ? "Good standing" : `${activeCount} active strike${activeCount > 1 ? "s" : ""}`}
          </span>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {loading && <p className="text-sm text-ink-muted">Loading…</p>}

        {!loading && strikes.length === 0 && (
          <div className="rounded-xl2 glass-card p-6 text-center text-sm text-ink-muted">
            No strikes on record. Nothing to see here — that's a good thing.
          </div>
        )}

        {strikes.map((strike) => (
          <div key={strike.id} className="rounded-xl2 glass-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{strike.guideline_violated}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {new Date(strike.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[strike.status]}`}>
                {strike.status}
              </span>
            </div>

            <p className="mt-3 text-sm">{strike.reason}</p>

            {strike.status === "active" && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={appealDraft[strike.id] ?? ""}
                  onChange={(e) => setAppealDraft((prev) => ({ ...prev, [strike.id]: e.target.value }))}
                  placeholder="Explain why you believe this strike should be removed…"
                  rows={3}
                  className="w-full rounded-lg bg-black/5 p-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-from dark:bg-white/10"
                />
                <button
                  onClick={() => submitAppeal(strike.id)}
                  disabled={!appealDraft[strike.id]?.trim()}
                  className="rounded-full bg-brand-gradient px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
                >
                  Submit appeal
                </button>
              </div>
            )}

            {strike.status === "appealed" && (
              <p className="mt-3 text-xs text-ink-muted">
                Appeal submitted{" "}
                {strike.appeal_submitted_at && new Date(strike.appeal_submitted_at).toLocaleDateString()}.
                A reviewer will respond here — you'll never be left guessing.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
