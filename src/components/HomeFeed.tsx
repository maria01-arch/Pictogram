"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Post } from "@/types/database";
import PostCard from "./PostCard";
import StoriesBar from "./StoriesBar";
import { useTopLoading } from "./TopLoadingBar";

const PAGE_SIZE = 10;

export default function HomeFeed() {
  const { start, done } = useTopLoading();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadPosts = useCallback(async (offset: number) => {
    start();
    const { data, error } = await supabase
      .from("posts")
      .select("*, profiles!posts_user_id_fkey(username, avatar_url, is_verified)")
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error("Failed to load feed:", error.message);
      return;
    }

    setPosts((prev) => (offset === 0 ? data ?? [] : [...prev, ...(data ?? [])]));
    setHasMore((data?.length ?? 0) === PAGE_SIZE);
    done();
  }, [done, start]);

  useEffect(() => {
    loadPosts(0).then(() => setLoading(false));
  }, [loadPosts]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          setLoadingMore(true);
          loadPosts(posts.length).finally(() => setLoadingMore(false));
        }
      },
      { rootMargin: "400px" } // start loading before the sentinel is actually on-screen
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, hasMore, loadingMore, posts.length, loadPosts]);

  return (
    <div>
      <StoriesBar />

      {loading ? (
        <FeedSkeleton />
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-24 text-center text-ink-muted">
          <p className="text-lg font-semibold">Nothing here yet</p>
          <p className="text-sm">Follow a few creators or post something to get your feed going.</p>
        </div>
      ) : (
        <div className="px-3 pt-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))} />
          ))}

          <div ref={sentinelRef} className="h-4" />
          {loadingMore && <p className="pb-4 text-center text-xs text-ink-muted">Loading more…</p>}
          {!hasMore && <p className="pb-6 text-center text-xs text-ink-muted">You're all caught up.</p>}
        </div>
      )}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="px-3 pt-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="mb-4 animate-pulse overflow-hidden rounded-xl2 glass-card">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="h-9 w-9 rounded-full bg-black/10 dark:bg-white/10" />
            <div className="h-3 w-24 rounded bg-black/10 dark:bg-white/10" />
          </div>
          <div className="aspect-[4/5] w-full bg-black/10 dark:bg-white/10" />
        </div>
      ))}
    </div>
  );
}
