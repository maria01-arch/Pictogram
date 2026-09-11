"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Post } from "@/types/database";
import PostCard from "./PostCard";
import { SkeletonBlock, SkeletonCircle } from "./Skeleton";

export default function SinglePostView({ postId }: { postId: string }) {
  const [post, setPost] = useState<Post | null | "not-found">(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("posts")
      .select("*, profiles!posts_user_id_fkey(username, avatar_url, is_verified), post_media(*)")
      .eq("id", postId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        setPost(error || !data ? "not-found" : (data as Post));
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (post === null) {
    return (
      <div className="px-4 pt-4">
        <div className="flex items-center gap-3">
          <SkeletonCircle size={40} />
          <SkeletonBlock className="h-3.5 w-28" />
        </div>
        <SkeletonBlock className="mt-3 aspect-square w-full rounded-xl2" />
      </div>
    );
  }

  if (post === "not-found") {
    return (
      <div className="flex flex-col items-center gap-1 px-6 py-16 text-center text-ink-muted">
        <p className="font-semibold">Post not found</p>
        <p className="text-sm">It may have been deleted, or you don't have access to it.</p>
      </div>
    );
  }

  return (
    <div className="pt-2">
      <PostCard post={post} fullCaption />
    </div>
  );
}
