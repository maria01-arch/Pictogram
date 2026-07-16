"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getFollowRelation, toggleFollow, type FollowRelation } from "@/lib/follow";
import { getOrCreateDirectConversation } from "@/lib/conversations";
import { getErrorMessage } from "@/lib/errorMessage";
import type { Profile, Post, Story } from "@/types/database";

export default function ProfileView({ username }: { username: string }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [hasActiveStory, setHasActiveStory] = useState(false);
  const [relation, setRelation] = useState<FollowRelation>("none");
  const [isSelf, setIsSelf] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [username]);

  async function load() {
    const { data: p } = await supabase.from("profiles").select("*").eq("username", username).single();
    if (!p) return setLoading(false);
    setProfile(p);

    const { data: { user } } = await supabase.auth.getUser();
    setIsSelf(user?.id === p.id);

    const { data: postRows } = await supabase
      .from("posts")
      .select("*")
      .eq("user_id", p.id)
      .order("created_at", { ascending: false });
    setPosts(postRows ?? []);

    const { count } = await supabase
      .from("stories")
      .select("*", { count: "exact", head: true })
      .eq("user_id", p.id)
      .gt("expires_at", new Date().toISOString());
    setHasActiveStory((count ?? 0) > 0);

    if (user && user.id !== p.id) {
      setRelation(await getFollowRelation(p.id));
    }
    setLoading(false);
  }

  async function handleFollow() {
    if (!profile) return;
    setError(null);
    const prev = relation;
    try {
      await toggleFollow(profile.id, relation);
      setRelation(prev === "none" ? (profile.requires_follow_approval ? "pending" : "following") : "none");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleMessage() {
    if (!profile) return;
    setError(null);
    try {
      const conversationId = await getOrCreateDirectConversation(profile.id);
      router.push(`/chat?conversation=${conversationId}`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  if (loading) return <p className="px-4 py-16 text-center text-sm text-ink-muted">Loading…</p>;
  if (!profile) return <p className="px-4 py-16 text-center text-sm text-ink-muted">Profile not found.</p>;

  return (
    <div className="pb-8">
      <div className="flex flex-col items-center px-4 pt-6">
        <div className={hasActiveStory ? "rounded-full bg-brand-gradient p-0.5" : ""}>
          <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-surface-lightMuted bg-brand-gradient dark:border-surface-darkMuted">
            {profile.avatar_url && <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />}
          </div>
        </div>

        <h2 className="mt-3 text-lg font-bold">{profile.display_name ?? profile.username}</h2>
        <p className="text-sm text-ink-muted">@{profile.username}</p>
        {profile.bio && <p className="mt-2 max-w-xs text-center text-sm">{profile.bio}</p>}
        {profile.location && (
          <p className="mt-1 text-xs text-ink-muted">📍 {profile.location}</p>
        )}

        {!isSelf && (
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleFollow}
              className={`rounded-full px-5 py-2 text-sm font-semibold ${
                relation === "none" ? "bg-brand-gradient text-white" : "bg-black/5 text-ink-muted dark:bg-white/10"
              }`}
            >
              {relation === "none" ? "Follow" : relation === "pending" ? "Requested" : "Following"}
            </button>
            <button onClick={handleMessage} className="rounded-full bg-black/5 px-5 py-2 text-sm font-semibold dark:bg-white/10">
              Message
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-0.5 px-0.5">
        {posts.map((post) => (
          <div key={post.id} className="aspect-square overflow-hidden bg-black/5 dark:bg-white/5">
            <img
              src={post.thumbnail_url ?? post.media_url}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>

      {posts.length === 0 && (
        <p className="mt-10 text-center text-sm text-ink-muted">No posts yet.</p>
      )}
    </div>
  );
}
