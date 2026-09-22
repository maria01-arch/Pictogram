"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import CommentsSheet from "./CommentsSheet";
import { getUserLocal } from "@/lib/authUser";
import ShareSheet from "./ShareSheet";

export default function PostActions({
  postId,
  postOwnerId,
  liked,
  likeCount,
  onToggleLike,
  initialSaved,
  initialCommentCount,
  shareCaption,
  shareMediaUrl,
  shareMediaType,
  disableDownload,
}: {
  postId: string;
  postOwnerId?: string;
  liked: boolean;
  likeCount: number;
  onToggleLike: () => void;
  // Provided by the feed (already fetched) so we don't query per post.
  initialSaved?: boolean;
  initialCommentCount?: number;
  shareCaption?: string | null;
  shareMediaUrl?: string | null;
  shareMediaType?: "image" | "video" | "text" | "carousel";
  disableDownload?: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved ?? false);
  const [commentCount, setCommentCount] = useState(initialCommentCount ?? 0);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (initialSaved !== undefined && initialCommentCount !== undefined) {
      getUserLocal().then(({ data }) => setUserId(data.user?.id ?? null));
    } else {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  async function load() {
    const [{ data: { user } }, commentsCountRes] = await Promise.all([
      getUserLocal(),
      supabase.from("comments").select("*", { count: "exact", head: true }).eq("post_id", postId),
    ]);

    setUserId(user?.id ?? null);
    setCommentCount(commentsCountRes.count ?? 0);

    if (user) {
      const { data } = await supabase.from("saves").select("post_id").eq("post_id", postId).eq("user_id", user.id).maybeSingle();
      setSaved(!!data);
    }
  }

  async function toggleSave() {
    if (!userId) return;
    if (saved) {
      setSaved(false);
      await supabase.from("saves").delete().eq("post_id", postId).eq("user_id", userId);
    } else {
      setSaved(true);
      await supabase.from("saves").insert({ post_id: postId, user_id: userId });
    }
  }


  return (
    <>
      {/* Flat, minimal row — this now sits in the caption area on the
          card's normal background, not floating over an image, so it
          uses the page's ink color instead of white/translucent-on-dark. */}
      <div className="flex items-center gap-4 px-4 pt-2.5 pb-1 text-ink-light dark:text-ink-dark">
        <button onClick={onToggleLike} className="flex items-center gap-1.5" aria-label="Like">
          <svg width="21" height="21" viewBox="0 0 24 24" fill={liked ? "#EF4444" : "none"} stroke={liked ? "#EF4444" : "currentColor"} strokeWidth="1.8">
            <path d="M20.8 8.6c0 4.7-8.8 10-8.8 10s-8.8-5.3-8.8-10a4.6 4.6 0 018.8-1.9A4.6 4.6 0 0120.8 8.6z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {likeCount > 0 && <span className="text-xs font-semibold">{likeCount}</span>}
        </button>

        <button onClick={() => setShowComments(true)} className="flex items-center gap-1.5" aria-label="Comments">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 11.5a8.38 8.38 0 01-8.5 8.5 8.5 8.5 0 01-4-1L3 20l1-5.5A8.38 8.38 0 0112 3a8.38 8.38 0 019 8.5z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {commentCount > 0 && <span className="text-xs font-semibold">{commentCount}</span>}
        </button>

        <button onClick={() => setShowShare(true)} aria-label="Share">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <button onClick={toggleSave} className="ml-auto" aria-label="Save">
          <svg width="21" height="21" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
            <path d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {showShare && (
        <ShareSheet
          url={`${window.location.origin}/post/${postId}`}
          text={shareCaption?.trim() || "Check out this post"}
          mediaUrl={shareMediaUrl}
          mediaType={shareMediaType}
          disableDownload={disableDownload}
          onClose={() => setShowShare(false)}
        />
      )}

      {showComments && <CommentsSheet
          postId={postId}
          postOwnerId={postOwnerId}
          onCountChange={(delta) => setCommentCount((c) => Math.max(0, c + delta))}
          onClose={() => setShowComments(false)}
        />}
    </>
  );
}
