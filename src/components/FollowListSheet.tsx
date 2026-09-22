"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Portal from "./Portal";
import { useScrollLock } from "@/lib/useScrollLock";
import { getFollowers, getFollowing, getFollowingVisibility } from "@/lib/follow";
import VerifiedBadge from "./VerifiedBadge";
import type { FollowListEntry } from "@/types/database";

export default function FollowListSheet({
  userId,
  mode,
  isSelf,
  onClose,
}: {
  userId: string;
  mode: "followers" | "following";
  isSelf: boolean;
  onClose: () => void;
}) {
  useScrollLock();
  const [rows, setRows] = useState<FollowListEntry[] | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (mode === "following" && !isSelf) {
        const visible = await getFollowingVisibility(userId);
        if (!visible) {
          if (!cancelled) {
            setHidden(true);
            setRows([]);
          }
          return;
        }
      }
      const data = mode === "followers" ? await getFollowers(userId) : await getFollowing(userId);
      if (!cancelled) setRows(data);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId, mode, isSelf]);

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={onClose}>
        <div
          className="safe-bottom flex max-h-[80vh] w-full max-w-lg flex-col rounded-t-2xl glass-card"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-black/5 px-4 py-3.5 dark:border-white/5">
            <p className="text-base font-bold">{mode === "followers" ? "Fans" : "Following"}</p>
            <button onClick={onClose} className="text-sm font-semibold text-ink-muted">
              Close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2">
            {rows === null && (
              <div className="space-y-3 px-2 py-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-black/10 dark:bg-white/10" />
                    <div className="h-3.5 w-32 animate-pulse rounded bg-black/10 dark:bg-white/10" />
                  </div>
                ))}
              </div>
            )}

            {hidden && (
              <p className="px-3 py-10 text-center text-sm text-ink-muted">
                This person has hidden who they're following.
              </p>
            )}

            {rows !== null && !hidden && rows.length === 0 && (
              <p className="px-3 py-10 text-center text-sm text-ink-muted">
                {mode === "followers" ? "No fans yet." : "Not following anyone yet."}
              </p>
            )}

            {rows?.map((r) => (
              <Link
                key={r.id}
                href={`/profile/${r.username}`}
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl2 px-2 py-2.5 transition hover:bg-black/5 dark:hover:bg-white/5"
              >
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-brand-gradient">
                  {r.avatar_url && <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-sm font-semibold">
                    {r.display_name || r.username}
                    {r.is_verified && <VerifiedBadge size={13} />}
                  </p>
                  <p className="truncate text-xs text-ink-muted">@{r.username}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Portal>
  );
}
