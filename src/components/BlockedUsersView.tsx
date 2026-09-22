"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getUserLocal } from "@/lib/authUser";
import { unblockUser } from "@/lib/block";

interface BlockedRow {
  id: string;
  username: string;
  avatar_url: string | null;
}

export default function BlockedUsersView() {
  const [rows, setRows] = useState<BlockedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await getUserLocal();
      if (!user) return setLoading(false);
      const { data } = await supabase
        .from("blocked_users")
        .select("blocked_id, profiles!blocked_users_blocked_id_fkey(username, avatar_url)")
        .eq("blocker_id", user.id);
      setRows(
        (data ?? []).map((r: any) => ({
          id: r.blocked_id,
          username: r.profiles?.username ?? "unknown",
          avatar_url: r.profiles?.avatar_url ?? null,
        }))
      );
      setLoading(false);
    }
    load();
  }, []);

  async function handleUnblock(id: string) {
    setBusyId(id);
    try {
      await unblockUser(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="px-4 pb-10 pt-4">
      <h2 className="text-lg font-bold">Privacy</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Blocked people can't message, follow or comment on you, and you won't see their content.
      </p>

      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-ink-muted">Blocked accounts</h3>

      {loading && <p className="text-sm text-ink-muted">Loading…</p>}
      {!loading && rows.length === 0 && (
        <div className="rounded-xl2 glass-card p-6 text-center text-sm text-ink-muted">You haven't blocked anyone.</div>
      )}

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-xl2 glass-card px-3 py-2.5">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-brand-gradient">
              {r.avatar_url && <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />}
            </div>
            <Link href={`/profile/${r.username}`} className="min-w-0 flex-1 truncate text-sm font-semibold">
              {r.username}
            </Link>
            <button
              onClick={() => handleUnblock(r.id)}
              disabled={busyId === r.id}
              className="rounded-full bg-black/5 px-4 py-1.5 text-xs font-semibold disabled:opacity-40 dark:bg-white/10"
            >
              Unblock
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
