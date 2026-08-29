"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { createNotification } from "@/lib/notifications";
import CommentsSheet from "./CommentsSheet";

export default function PostActions({ postId, postOwnerId }: { postId: string; postOwnerId?: string }) {
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
    // Fire all independent reads in parallel instead of sequentially —
    // this was 5 back-to-back round trips per post card, a real source
    // of feed lag when several cards load at once.
    const [{ data: { user } }, likesCountRes, commentsCountRes] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("likes").select("*", { count: "exact", head: true }).eq("post_id", postId),
      supabase.from("comments").select("*", { count: "exact", head: true }).eq("post_id", postId),
    ]);

    setUserId(user?.id ?? null);
    setLikeCount(likesCountRes.count ?? 0);
    setCommentCount(commentsCountRes.count ?? 0);

    if (user) {
      const [likeRowRes, saveRowRes] = await Promise.all([
        supabase.from("likes").select("post_id").eq("post_id", postId).eq("user_id", user.id).maybeSingle(),
        supabase.from("saves").select("post_id").eq("post_id", postId).eq("user_id", user.id).maybeSingle(),
      ]);
      setLiked(!!likeRowRes.data);
      setSaved(!!saveRowRes.data);
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
      if (postOwnerId) {
        const { data: me } = await supabase.from("profiles").select("username").eq("id", userId).single();
        createNotification({
          targetUserId: postOwnerId,
          type: "like",
          postId,
          pushTitle: "New like",
          pushBody: `${me?.username ?? "Someone"} liked your post`,
        });
      }
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
      <div className="flex flex-col items-center gap-4">
        <button onClick={toggleLike} className="flex flex-col items-center gap-1" aria-label="Like">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-black/35 backdrop-blur-md">
            <svg width="21" height="21" viewBox="0 0 24 24" fill={liked ? "#EF4444" : "none"} stroke={liked ? "#EF4444" : "white"} strokeWidth="1.8">
              <path d="M20.8 8.6c0 4.7-8.8 10-8.8 10s-8.8-5.3-8.8-10a4.6 4.6 0 018.8-1.9A4.6 4.6 0 0120.8 8.6z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          {likeCount > 0 && <span className="text-xs font-semibold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]">{likeCount}</span>}
        </button>

        <button onClick={() => setShowComments(true)} className="flex flex-col items-center gap-1" aria-label="Comments">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-black/35 backdrop-blur-md">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
              <path d="M21 11.5a8.38 8.38 0 01-8.5 8.5 8.5 8.5 0 01-4-1L3 20l1-5.5A8.38 8.38 0 0112 3a8.38 8.38 0 019 8.5z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          {commentCount > 0 && <span className="text-xs font-semibold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]">{commentCount}</span>}
        </button>

        <button onClick={share} className="flex flex-col items-center gap-1" aria-label="Share">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-black/35 backdrop-blur-md">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
              <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>

        <button onClick={toggleSave} className="flex flex-col items-center gap-1" aria-label="Save">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-black/35 backdrop-blur-md">
            <svg width="21" height="21" viewBox="0 0 24 24" fill={saved ? "white" : "none"} stroke="white" strokeWidth="1.8">
              <path d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
      </div>

      {showComments && <CommentsSheet postId={postId} postOwnerId={postOwnerId} onClose={() => setShowComments(false)} />}
    </>
  );
}
