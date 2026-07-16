"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function SettingsView() {
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setLoading(false);
      setUserId(user.id);

      const { data } = await supabase.from("profiles").select("requires_follow_approval").eq("id", user.id).single();
      setRequiresApproval(!!data?.requires_follow_approval);
      setLoading(false);
    }
    load();
  }, []);

  async function toggle() {
    if (!userId) return;
    const next = !requiresApproval;
    setRequiresApproval(next);
    await supabase.from("profiles").update({ requires_follow_approval: next }).eq("id", userId);
  }

  if (loading) return <p className="px-4 py-16 text-center text-sm text-ink-muted">Loading…</p>;

  return (
    <div className="px-4 pb-8 pt-4">
      <h2 className="text-lg font-bold">Settings</h2>

      <div className="mt-5 flex items-center justify-between rounded-xl2 glass-card px-4 py-3.5">
        <div>
          <p className="text-sm font-semibold">Approve new followers</p>
          <p className="mt-0.5 text-xs text-ink-muted">Review requests before someone can follow you</p>
        </div>
        <button
          onClick={toggle}
          className={`h-6 w-11 shrink-0 rounded-full transition ${requiresApproval ? "bg-brand-gradient" : "bg-black/15 dark:bg-white/15"}`}
        >
          <span className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white transition-transform ${requiresApproval ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>
    </div>
  );
}
