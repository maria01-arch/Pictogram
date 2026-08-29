"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { createNotification } from "./notifications";

// Single source of truth for a post's like state, shared between the
// action pill's heart button and the double-tap gesture on the media
// itself — both need to read/update the exact same state, not two
// independently-fetched copies that could drift out of sync.
export function usePostLike(postId: string, postOwnerId?: string) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [postId]);

  async function load() {
    const [{ data: { user } }, countRes] = await Promise.all([
      supabase.auth.getUser(),
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
