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
  // Generated once per mount (i.e. once per page load/refresh) and reused
  // for every paginated call in this session — see add_feed_ranking.sql.
  const seedRef = useRef(Math.random() * 2 - 1);

  const loadPosts = useCallback(async (offset: number) => {
    start();
    const { data: rankedRows, error: rankError } = await supabase.rpc("feed_ranked_ids", {
      page_limit: PAGE_SIZE,
      page_offset: offset,
      seed: seedRef.current,
    });

    if (rankError || !rankedRows || rankedRows.length === 0) {
      if (rankError) console.error("Failed to rank feed:", rankError.message);
      setHasMore(false);
      done();
      return;
    }

    const ids = rankedRows.map((r: { id: string }) => r.id);
    const { data, error } = await supabase
      .from("posts")
      .select("*, profiles!posts_user_id_fkey(username, avatar_url, is_verified), post_media(*)")
      .in("id", ids)
      .order("position", { foreignTable: "post_media", ascending: true });

    if (error) {
      console.error("Failed to load feed:", error.message);
      done();
      return;
    }

    // .in() doesn't preserve the id order we asked for — re-sort to match
    // the ranking the RPC actually gave us.
    const rank = new Map<string, number>(ids.map((id: string, i: number) => [id, i]));
    const ordered = [...(data ?? [])].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));

    setPosts((prev) => (offset === 0 ? ordered : [...prev, ...ordered]));
    setHasMore(ids.length === PAGE_SIZE);
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
