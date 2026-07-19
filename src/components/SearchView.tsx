"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Post, Profile } from "@/types/database";
import VerifiedBadge from "./VerifiedBadge";

function SearchViewInner() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setProfiles([]);
      setPosts([]);
      return;
    }
    const timeout = setTimeout(runSearch, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function runSearch() {
    setLoading(true);
    const term = query.trim();

    const [{ data: profileResults }, { data: postResults }] = await Promise.all([
      supabase.from("profiles").select("*").ilike("username", `%${term}%`).limit(20),
      supabase
        .from("posts")
        .select("*, profiles!posts_user_id_fkey(username, avatar_url, is_verified)")
        .or(`caption.ilike.%${term}%,text_content.ilike.%${term}%`)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    setProfiles(profileResults ?? []);
    setPosts(postResults ?? []);
    setLoading(false);
  }

  return (
    <div className="px-4 pb-8 pt-4">
      <div className="sticky top-0 z-10 -mx-4 bg-surface-lightMuted px-4 pb-3 dark:bg-surface-darkMuted">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people, captions, or #hashtags…"
          autoFocus
          className="w-full rounded-full bg-black/5 px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-from dark:bg-white/10"
        />
      </div>

      {loading && <p className="mt-4 text-sm text-ink-muted">Searching…</p>}

      {!loading && query.trim() && profiles.length === 0 && posts.length === 0 && (
        <p className="mt-10 text-center text-sm text-ink-muted">No results for "{query}"</p>
      )}

      {profiles.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">People</h3>
          <div className="overflow-hidden rounded-xl2 glass-card">
            {profiles.map((p, i) => (
              <Link
                key={p.id}
                href={`/profile/${p.username}`}
                className={`flex items-center gap-3 px-4 py-3 ${i !== 0 ? "border-t border-black/5 dark:border-white/5" : ""}`}
              >
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-brand-gradient">
                  {p.avatar_url && <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <p className="flex items-center gap-1 text-sm font-semibold">
                  {p.username}
                  {p.is_verified && <VerifiedBadge size={12} />}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {posts.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Posts</h3>
          <div className="grid grid-cols-3 gap-0.5">
            {posts.map((post) => (
              <Link key={post.id} href={`/profile/${post.profiles?.username ?? ""}`} className="aspect-square overflow-hidden bg-black/5 dark:bg-white/5">
                {post.thumbnail_url || post.media_url ? (
                  <img src={post.thumbnail_url ?? post.media_url ?? ""} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-brand-gradient p-2 text-center text-[10px] text-white">
                    {post.text_content?.slice(0, 40)}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchView() {
  return (
    <Suspense fallback={<p className="px-4 py-6 text-sm text-ink-muted">Loading…</p>}>
      <SearchViewInner />
    </Suspense>
  );
}
