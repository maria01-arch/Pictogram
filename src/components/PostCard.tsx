"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Post } from "@/types/database";
import TapToPlayVideo from "./TapToPlayVideo";
import PostActions from "./PostActions";
import VerifiedBadge from "./VerifiedBadge";

const CAPTION_LIMIT = 80;

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  const units: [number, string][] = [
    [31536000, "y"], [2592000, "mo"], [86400, "d"], [3600, "h"], [60, "m"],
  ];
  for (const [secs, label] of units) {
    const value = Math.floor(seconds / secs);
    if (value >= 1) return `${value}${label}`;
  }
  return "now";
}

export default function PostCard({ post, onDeleted }: { post: Post; onDeleted?: (id: string) => void }) {
  const username = post.profiles?.username;
  const [userId, setUserId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const isOwner = userId === post.user_id;
  const caption = post.caption ?? "";
  const isLong = caption.length > CAPTION_LIMIT;
  const displayCaption = !isLong || expanded ? caption : caption.slice(0, CAPTION_LIMIT) + "…";

  async function handleDelete() {
    if (!confirm("Delete this post? This can't be undone.")) return;
    setDeleting(true);
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    setDeleting(false);
    if (error) {
      alert("Failed to delete post: " + error.message);
      return;
    }
    onDeleted?.(post.id);
  }

  return (
    <article className="mb-4 overflow-hidden rounded-xl2 glass-card shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3">
        <Link href={username ? `/profile/${username}` : "#"} className="flex min-w-0 flex-1 items-center gap-3">
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-brand-gradient">
            {post.profiles?.avatar_url && (
              <img src={post.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <p className="flex items-center gap-1 truncate text-sm font-semibold">{username ?? "unknown"}{post.profiles?.is_verified && <VerifiedBadge />}</p>
        </Link>
        <span className="shrink-0 text-xs text-ink-muted">{timeAgo(post.created_at)}</span>

        {isOwner && (
          <div className="relative shrink-0">
            <button onClick={() => setMenuOpen((o) => !o)} className="p-1 text-ink-muted" aria-label="Post options">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-7 z-10 w-32 overflow-hidden rounded-xl2 glass-card shadow-lg">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full px-3 py-2.5 text-left text-sm font-medium text-red-500 disabled:opacity-40"
                >
                  {deleting ? "Deleting…" : "Delete post"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {post.media_type === "video" ? (
        <TapToPlayVideo
          videoUrl={post.media_url}
          thumbnailUrl={post.thumbnail_url}
          aspectRatio={post.width && post.height ? post.width / post.height : 4 / 5}
        />
      ) : (
        <img
          src={post.media_url}
          alt={post.caption ?? ""}
          loading="lazy"
          className="w-full object-cover"
          style={{ aspectRatio: post.width && post.height ? post.width / post.height : 4 / 5 }}
        />
      )}

      <PostActions postId={post.id} />

      {caption && (
        <p className="px-4 pb-3 text-sm leading-snug">
          <span className="mr-1.5 font-semibold">{username}</span>
          {displayCaption}
          {isLong && (
            <button onClick={() => setExpanded((e) => !e)} className="ml-1 font-medium text-ink-muted">
              {expanded ? "less" : "more"}
            </button>
          )}
        </p>
      )}
    </article>
  );
}
