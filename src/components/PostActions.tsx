"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import CommentsSheet from "./CommentsSheet";

export default function PostActions({
  postId,
  postOwnerId,
  liked,
  likeCount,
  onToggleLike,
}: {
  postId: string;
  postOwnerId?: string;
  liked: boolean;
  likeCount: number;
  onToggleLike: () => void;
}) {
  const [saved, setSaved] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [postId]);

  async function load() {
    const [{ data: { user } }, commentsCountRes] = await Promise.all([
      supabase.auth.getUser(),
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

  async function share() {
    const url = `${window.location.origin}/post/${postId}`;
    if (navigator.share) {
      try {
        await navigator.share({ url });
      } catch {
        // user cancelled — no-op
      }
    } else {
      await navigator.clipboard.writeText(url);
    }
  }

  return (
    <>
      {/* Fixed-height horizontal pill — a vertical stack risked exceeding
          shorter media (short text cards, small-aspect images) and
          spilling out past the card edge. A single row can't do that:
          height stays constant (~40px) no matter how many icons are in it. */}
      <div className="flex h-10 items-center gap-3 rounded-full bg-black/35 px-3.5 backdrop-blur-md">
        <button onClick={onToggleLike} className="flex items-center gap-1" aria-label="Like">
          <svg width="19" height="19" viewBox="0 0 24 24" fill={liked ? "#EF4444" : "none"} stroke={liked ? "#EF4444" : "white"} strokeWidth="1.8">
            <path d="M20.8 8.6c0 4.7-8.8 10-8.8 10s-8.8-5.3-8.8-10a4.6 4.6 0 018.8-1.9A4.6 4.6 0 0120.8 8.6z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {likeCount > 0 && <span className="text-xs font-semibold text-white">{likeCount}</span>}
        </button>

        <button onClick={() => setShowComments(true)} className="flex items-center gap-1" aria-label="Comments">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
            <path d="M21 11.5a8.38 8.38 0 01-8.5 8.5 8.5 8.5 0 01-4-1L3 20l1-5.5A8.38 8.38 0 0112 3a8.38 8.38 0 019 8.5z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {commentCount > 0 && <span className="text-xs font-semibold text-white">{commentCount}</span>}
        </button>

        <button onClick={share} aria-label="Share">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
            <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <button onClick={toggleSave} aria-label="Save">
          <svg width="19" height="19" viewBox="0 0 24 24" fill={saved ? "white" : "none"} stroke="white" strokeWidth="1.8">
            <path d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {showComments && <CommentsSheet postId={postId} postOwnerId={postOwnerId} onClose={() => setShowComments(false)} />}
    </>
  );
}
