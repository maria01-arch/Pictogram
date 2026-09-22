"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { createNotification } from "./notifications";
import { getUserLocal } from "@/lib/authUser";

// Single source of truth for a post's like state, shared between the
// action pill's heart button and the double-tap gesture on the media
// itself — both need to read/update the exact same state, not two
// independently-fetched copies that could drift out of sync.
export function usePostLike(
  postId: string,
  postOwnerId?: string,
  // When the feed already fetched these, we skip the per-post queries entirely.
  initial?: { liked: boolean; likeCount: number }
) {
  const [liked, setLiked] = useState(initial?.liked ?? false);
  const [likeCount, setLikeCount] = useState(initial?.likeCount ?? 0);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (initial) {
      getUserLocal().then(({ data }) => setUserId(data.user?.id ?? null));
    } else {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  async function load() {
    const [{ data: { user } }, countRes] = await Promise.all([
      getUserLocal(),
      supabase.from("likes").select("*", { count: "exact", head: true }).eq("post_id", postId),
    ]);
    setUserId(user?.id ?? null);
    setLikeCount(countRes.count ?? 0);
    if (user) {
      const { data } = await supabase
        .from("likes")
        .select("post_id")
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .maybeSingle();
      setLiked(!!data);
    }
  }

  async function like() {
    if (!userId || liked) return; // double-tap always likes, never unlikes
    setLiked(true);
    setLikeCount((c) => c + 1);
    await supabase.from("likes").insert({ post_id: postId, user_id: userId });
    if (postOwnerId) {
      createNotification({ targetUserId: postOwnerId, type: "like", postId });
    }
  }

  async function unlike() {
    if (!userId || !liked) return;
    setLiked(false);
    setLikeCount((c) => c - 1);
    await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", userId);
  }

  async function toggleLike() {
    if (liked) await unlike();
    else await like();
  }

  return { liked, likeCount, like, toggleLike };
}
