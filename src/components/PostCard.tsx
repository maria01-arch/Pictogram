"use client";

import Link from "next/link";
import type { Post } from "@/types/database";
import TapToPlayVideo from "./TapToPlayVideo";
import PostActions from "./PostActions";

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

export default function PostCard({ post }: { post: Post }) {
  const username = post.profiles?.username;

  return (
    <article className="mb-4 overflow-hidden rounded-xl2 glass-card shadow-sm">
      <Link href={username ? `/profile/${username}` : "#"} className="flex items-center gap-3 px-4 py-3">
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-brand-gradient">
          {post.profiles?.avatar_url && (
            <img src={post.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{username ?? "unknown"}</p>
        </div>
        <span className="shrink-0 text-xs text-ink-muted">{timeAgo(post.created_at)}</span>
      </Link>

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

      {post.caption && (
        <p className="px-4 pb-3 text-sm leading-snug">
          <span className="mr-1.5 font-semibold">{username}</span>
          {post.caption}
        </p>
      )}
    </article>
  );
}
