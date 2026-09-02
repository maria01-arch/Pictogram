"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { Post } from "@/types/database";
import PostCard from "./PostCard";

export default function SavedView() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("saves")
      .select("created_at, posts(*, profiles!posts_user_id_fkey(username, avatar_url, is_verified), post_media(*))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load saved posts:", error.message);
      setLoading(false);
      return;
    }

    const savedPosts = (data ?? [])
      .map((row) => row.posts as unknown as Post)
      .filter(Boolean);
    setPosts(savedPosts);
    setLoading(false);
  }

  return (
    <div>
      <header className="safe-top sticky top-0 z-30 flex items-center gap-3 border-b border-black/5 bg-surface-lightMuted px-3 py-3 dark:border-white/5 dark:bg-surface-darkMuted">
        <button onClick={() => router.back()} aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h2 className="text-base font-bold">Saved</h2>
      </header>

      {loading ? (
        <p className="px-4 py-16 text-center text-sm text-ink-muted">Loading…</p>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-24 text-center text-ink-muted">
          <p className="text-lg font-semibold">Nothing saved yet</p>
          <p className="text-sm">Tap the bookmark icon on a post to save it here.</p>
        </div>
      ) : (
        <div className="pt-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))} />
          ))}
        </div>
      )}
    </div>
  );
}
