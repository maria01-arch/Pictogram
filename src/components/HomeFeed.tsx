"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Post } from "@/types/database";
import PostCard from "./PostCard";
import StoriesBar from "./StoriesBar";

const PAGE_SIZE = 10;

export default function HomeFeed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  async function loadPosts(offset = 0) {
    const { data, error } = await supabase
      .from("posts")
      .select("*, profiles(username, avatar_url)")
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error("Failed to load feed:", error.message);
      setLoading(false);
      return;
    }

    setPosts((prev) => (offset === 0 ? data ?? [] : [...prev, ...(data ?? [])]));
    setHasMore((data?.length ?? 0) === PAGE_SIZE);
    setLoading(false);
  }

  useEffect(() => {
    loadPosts();
  }, []);

  if (loading) return <FeedSkeleton />;

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-24 text-center text-ink-muted">
        <p className="text-lg font-semibold">Nothing here yet</p>
        <p className="text-sm">Follow a few creators or post something to get your feed going.</p>
      </div>
    );
  }

  return (
    <div>
      <StoriesBar />
      <div className="px-3 pt-3">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      {hasMore && (
        <button
          onClick={() => loadPosts(posts.length)}
          className="mb-6 w-full rounded-xl2 border border-black/10 py-2.5 text-sm font-medium text-ink-muted transition hover:border-brand-from hover:text-brand-from dark:border-white/10"
        >
          Load more
        </button>
      )}
      </div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div>
      <StoriesBar />
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
