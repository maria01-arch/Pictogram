"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import CommentsSheet from "./CommentsSheet";

export default function PostActions({ postId }: { postId: string }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [saved, setSaved] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [postId]);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);

    const { count: likes } = await supabase
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("post_id", postId);
    setLikeCount(likes ?? 0);

    const { count: comments } = await supabase
      .from("comments")
      .select("*", { count: "exact", head: true })
      .eq("post_id", postId);
    setCommentCount(comments ?? 0);

    if (user) {
      const { data: likeRow } = await supabase
        .from("likes")
        .select("post_id")
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .maybeSingle();
      setLiked(!!likeRow);

      const { data: saveRow } = await supabase
        .from("saves")
        .select("post_id")
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .maybeSingle();
      setSaved(!!saveRow);
    }
  }

  async function toggleLike() {
    if (!userId) return;
    if (liked) {
      setLiked(false);
      setLikeCount((c) => c - 1);
      await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", userId);
    } else {
      setLiked(true);
      setLikeCount((c) => c + 1);
      await supabase.from("likes").insert({ post_id: postId, user_id: userId });
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
      <div className="flex items-center gap-4 px-4 py-2.5">
        <button onClick={toggleLike} className="flex items-center gap-1.5" aria-label="Like">
          <svg width="22" height="22" viewBox="0 0 24 24" fill={liked ? "#EF4444" : "none"} stroke={liked ? "#EF4444" : "currentColor"} strokeWidth="1.8">
            <path d="M20.8 8.6c0 4.7-8.8 10-8.8 10s-8.8-5.3-8.8-10a4.6 4.6 0 018.8-1.9A4.6 4.6 0 0120.8 8.6z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {likeCount > 0 && <span className="text-sm">{likeCount}</span>}
        </button>

        <button onClick={() => setShowComments(true)} className="flex items-center gap-1.5" aria-label="Comments">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 11.5a8.38 8.38 0 01-8.5 8.5 8.5 8.5 0 01-4-1L3 20l1-5.5A8.38 8.38 0 0112 3a8.38 8.38 0 019 8.5z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {commentCount > 0 && <span className="text-sm">{commentCount}</span>}
        </button>

        <button onClick={share} aria-label="Share">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <button onClick={toggleSave} className="ml-auto" aria-label="Save">
          <svg width="22" height="22" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
            <path d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {showComments && <CommentsSheet postId={postId} onClose={() => setShowComments(false)} />}
    </>
  );
}
