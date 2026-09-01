"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Post } from "@/types/database";
import TapToPlayVideo from "./TapToPlayVideo";
import PostActions from "./PostActions";
import VerifiedBadge from "./VerifiedBadge";
import HashtagText from "./HashtagText";
import PostCarousel from "./PostCarousel";
import ReadMoreText from "./ReadMoreText";
import ConfirmModal from "./ConfirmModal";
import PostMediaLightbox from "./PostMediaLightbox";
import { usePostLike } from "@/lib/usePostLike";

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
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const isOwner = userId === post.user_id;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const caption = post.caption ?? "";

  // Only videos get the max-4:5-frame treatment (spec calls this out for
  // video specifically — a true 16:9 landscape IMAGE is still allowed to
  // render at its full width). Anything landscape-leaning beyond a normal
  // 4:5/1:1 shape gets letterboxed; anything taller than 4:5 gets cropped.
  // Edited posts already have this baked into the file (native aspect ==
  // chosen aspect), so this only actually changes anything for older or
  // unedited video posts with arbitrary native aspects.
  const nativeAspect = post.width && post.height ? post.width / post.height : 4 / 5;
  const videoAspect = nativeAspect > 1.2 || nativeAspect < 0.8 ? 4 / 5 : nativeAspect;
  const videoFit: "cover" | "contain" = nativeAspect > 1.2 ? "contain" : "cover";

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const lastTapRef = useRef(0);
  const [heartPop, setHeartPop] = useState(false);
  const { liked, likeCount, like, toggleLike } = usePostLike(post.id, post.user_id);

  function startLongPress() {
    longPressFiredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setLightboxOpen(true);
    }, 450);
  }
  function handleTapEnd() {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    if (longPressFiredRef.current) return; // that was a long-press, not a tap

    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      like();
      setHeartPop(true);
      setTimeout(() => setHeartPop(false), 700);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }
  function cancelLongPress() {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  }
  function handleDoubleClick() {
    like();
    setHeartPop(true);
    setTimeout(() => setHeartPop(false), 700);
  }

  async function handleDelete() {
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
    <article className="mb-4 border-b border-black/10 pb-4 dark:border-white/10">
      <div className="relative">
        <div
          onTouchStart={startLongPress}
          onTouchEnd={handleTapEnd}
          onTouchMove={cancelLongPress}
          onDoubleClick={handleDoubleClick}
          onContextMenu={(e) => { e.preventDefault(); setLightboxOpen(true); }}
        >
          {post.media_type === "text" ? (
          <div className="flex min-h-[220px] items-center bg-brand-gradient px-6 pb-8 pt-16">
            <p className="text-lg font-medium leading-relaxed text-white">
              <ReadMoreText
                text={post.text_content ?? ""}
                limit={220}
                render={(t) => <HashtagText text={t} />}
              />
            </p>
          </div>
        ) : post.media_type === "carousel" ? (
          <PostCarousel
            items={post.post_media ?? []}
            aspectRatio={post.width && post.height ? post.width / post.height : 4 / 5}
          />
        ) : post.media_type === "video" ? (
          <TapToPlayVideo
            videoUrl={post.media_url!}
            thumbnailUrl={post.thumbnail_url}
            aspectRatio={videoAspect}
            fit={videoFit}
          />
        ) : (
          <img
            src={post.media_url!}
            alt={post.caption ?? ""}
            loading="lazy"
            className="w-full object-cover"
            style={{ aspectRatio: post.width && post.height ? post.width / post.height : 4 / 5 }}
          />
          )}
        </div>

        {/* Identity bar floats directly on the media instead of a separate
            header row above it — the media is the card, not a slot inside it. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-black/55 via-black/10 to-transparent p-3">
          <Link
            href={username ? `/profile/${username}` : "#"}
            className="pointer-events-auto flex min-w-0 items-center gap-2 rounded-full bg-black/25 py-1 pl-1 pr-3 backdrop-blur-md"
          >
            <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-brand-gradient ring-2 ring-white/40">
              {post.profiles?.avatar_url && (
                <img src={post.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <span className="flex min-w-0 items-center gap-1 truncate text-xs font-semibold text-white">
              {username ?? "unknown"}
              {post.profiles?.is_verified && <VerifiedBadge />}
            </span>
            <span className="shrink-0 text-[11px] text-white/70">· {timeAgo(post.created_at)}</span>
          </Link>

          {isOwner && (
            <div className="pointer-events-auto relative shrink-0">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="grid h-8 w-8 place-items-center rounded-full bg-black/25 text-white backdrop-blur-md"
                aria-label="Post options"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
                </svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-9 z-10 w-32 overflow-hidden rounded-xl2 glass-card shadow-lg">
                  <button
                    onClick={() => { setMenuOpen(false); setConfirmingDelete(true); }}
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

        {/* Double-tap / double-click heart pop, Instagram-style */}
        {heartPop && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <svg className="heart-pop-anim" width="90" height="90" viewBox="0 0 24 24" fill="#EF4444" stroke="white" strokeWidth="1">
              <path d="M20.8 8.6c0 4.7-8.8 10-8.8 10s-8.8-5.3-8.8-10a4.6 4.6 0 018.8-1.9A4.6 4.6 0 0120.8 8.6z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>

      {/* Actions now live in the caption area, not floating on the media —
          on short/text posts a floating rail covered too much of the card
          and made small posts feel busier than they needed to be. */}
      <PostActions
        postId={post.id}
        postOwnerId={post.user_id}
        liked={liked}
        likeCount={likeCount}
        onToggleLike={toggleLike}
      />

      {caption && (
        <p className="px-4 pb-3 text-sm leading-snug">
          <ReadMoreText text={caption} limit={CAPTION_LIMIT} render={(t) => <HashtagText text={t} />} />
        </p>
      )}

      {confirmingDelete && (
        <ConfirmModal
          title="Delete this post?"
          message="This can't be undone."
          confirmLabel="Delete"
          danger
          onConfirm={() => { setConfirmingDelete(false); handleDelete(); }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}

      {lightboxOpen && <PostMediaLightbox post={post} onClose={() => setLightboxOpen(false)} />}
    </article>
  );
}