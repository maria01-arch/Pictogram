"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getUserLocal } from "@/lib/authUser";
import { unblockUser } from "@/lib/block";
import { getMyPrivacySettings, updatePrivacySetting, type PrivacySettings, type PermissionSetting } from "@/lib/privacy";

function ToggleRow({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl2 glass-card px-4 py-3.5">
      <div className="pr-3">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`h-6 w-11 shrink-0 rounded-full transition ${value ? "bg-brand-gradient" : "bg-black/15 dark:bg-white/15"}`}
      >
        <span className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

// "Everyone" vs "People I follow" — used for both DMs and comments.
function PermissionRow({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description: string;
  value: PermissionSetting;
  onChange: (next: PermissionSetting) => void;
}) {
  return (
    <div className="rounded-xl2 glass-card px-4 py-3.5">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
      <div className="mt-3 flex gap-2 rounded-full bg-black/5 p-1 dark:bg-white/10">
        {([
          ["everyone", "Everyone"],
          ["people_i_follow", "People I follow"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`flex-1 rounded-full py-1.5 text-xs font-semibold transition ${
              value === key ? "bg-brand-gradient text-white" : "text-ink-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface BlockedRow {
  id: string;
  username: string;
  avatar_url: string | null;
}

export default function BlockedUsersView() {
  const [rows, setRows] = useState<BlockedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [privacy, setPrivacy] = useState<PrivacySettings | null>(null);

  useEffect(() => {
    getMyPrivacySettings().then(setPrivacy);
  }, []);

  function updatePrivacy(patch: Partial<PrivacySettings>) {
    setPrivacy((prev) => (prev ? { ...prev, ...patch } : prev));
    updatePrivacySetting(patch).catch(() => {
      // Revert on failure.
      getMyPrivacySettings().then(setPrivacy);
    });
  }

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
        Control who can interact with you and what other people can see.
      </p>

      {privacy && (
        <div className="mt-5 space-y-3">
          <ToggleRow
            title="Private account"
            description="Only followers you approve can see your posts and stories"
            value={privacy.is_locked}
            onChange={(v) => updatePrivacy({ is_locked: v })}
          />
          <PermissionRow
            title="Who can message you"
            description="Choose who can start a new conversation with you"
            value={privacy.dm_permission}
            onChange={(v) => updatePrivacy({ dm_permission: v })}
          />
          <PermissionRow
            title="Who can comment on your posts"
            description="People outside this group won't be able to comment"
            value={privacy.comment_permission}
            onChange={(v) => updatePrivacy({ comment_permission: v })}
          />
          <ToggleRow
            title="Hide who you're following"
            description="Other people won't be able to see your Following list"
            value={privacy.hide_following_list}
            onChange={(v) => updatePrivacy({ hide_following_list: v })}
          />
          <ToggleRow
            title="Turn off downloading"
            description="Remove the download option from the share sheet on your posts"
            value={privacy.disable_downloads}
            onChange={(v) => updatePrivacy({ disable_downloads: v })}
          />
        </div>
      )}

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
