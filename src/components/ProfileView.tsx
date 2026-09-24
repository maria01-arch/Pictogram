"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getFollowRelation, toggleFollow, type FollowRelation } from "@/lib/follow";
import { getOrCreateDirectConversation } from "@/lib/conversations";
import { getBlockStatus, blockUser, unblockUser } from "@/lib/block";
import { getErrorMessage } from "@/lib/errorMessage";
import VerifiedBadge from "./VerifiedBadge";
import type { Profile, Post } from "@/types/database";
import PostCard from "./PostCard";
import ReadMoreText from "./ReadMoreText";
import ConfirmModal from "./ConfirmModal";
import { useTopLoading } from "./TopLoadingBar";
import { ProfileSkeleton } from "./Skeleton";
import AvatarActionSheet from "./AvatarActionSheet";
import StoryViewer from "./StoryViewer";
import type { Story } from "@/types/database";
import { getUserLocal } from "@/lib/authUser";
import ReportSheet from "./ReportSheet";
import { submitReport } from "@/lib/reports";
import FollowListSheet from "./FollowListSheet";

const PROFILE_PAGE_SIZE = 60;

// The profile's own posts query doesn't join profiles (it's always the same
// person), but PostCard reads post.profiles for the header, download
// permission and lock status — so attach it here.
function attachOwnerProfile(rows: Post[], owner: Profile): Post[] {
  return rows.map((r) => ({
    ...r,
    profiles: {
      username: owner.username,
      avatar_url: owner.avatar_url,
      is_verified: owner.is_verified,
      disable_downloads: owner.disable_downloads,
      is_locked: owner.is_locked,
    },
  }));
}

export default function ProfileView({ username: rawUsername }: { username: string }) {
  const username = rawUsername.trim();
  const router = useRouter();
  const { start, done } = useTopLoading();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeStories, setActiveStories] = useState<Story[]>([]);
  const hasActiveStory = activeStories.length > 0;
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState(false);
  const [viewingStatus, setViewingStatus] = useState(false);
  const [relation, setRelation] = useState<FollowRelation>("none");
  const [isSelf, setIsSelf] = useState(false);
  const [blocked, setBlocked] = useState({ blockedByMe: false, blockedMe: false });
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [reportingUser, setReportingUser] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [followListMode, setFollowListMode] = useState<"followers" | "following" | null>(null);
  // 0 = at the top (full-size header), 1 = fully collapsed into the compact bar.
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const COLLAPSE_RANGE = 130;
    function onScroll() {
      setScrollProgress(Math.min(1, Math.max(0, window.scrollY / COLLAPSE_RANGE)));
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  async function load() {
    start();
    const { data: p } = await supabase.from("profiles").select("*").eq("username", username).single();
    if (!p) {
      setLoading(false);
      done();
      return;
    }
    setProfile(p);

    const { data: { user } } = await getUserLocal();
    setIsSelf(user?.id === p.id);

    const { data: postRows } = await supabase
      .from("posts")
      .select("*, post_media(*)")
      .eq("user_id", p.id)
      .order("created_at", { ascending: false })
      .order("position", { foreignTable: "post_media", ascending: true })
      .range(0, PROFILE_PAGE_SIZE - 1);
    setPosts(attachOwnerProfile(postRows ?? [], p));
    setHasMorePosts((postRows ?? []).length === PROFILE_PAGE_SIZE);

    const [followerRes, followingRes, likesRes] = await Promise.all([
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", p.id).eq("status", "accepted"),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", p.id).eq("status", "accepted"),
      // One server-side count instead of sending every post id in the URL.
      supabase.rpc("profile_like_count", { target_user: p.id }),
    ]);
    setFollowerCount(followerRes.count ?? 0);
    setFollowingCount(followingRes.count ?? 0);
    setLikeCount(Number((likesRes as any).data ?? 0));

    const { data: storyRows } = await supabase
      .from("stories")
      .select("*")
      .eq("user_id", p.id)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });
    setActiveStories(storyRows ?? []);

    if (user && user.id !== p.id) {
      setRelation(await getFollowRelation(p.id));
      setBlocked(await getBlockStatus(p.id));
    }
    setLoading(false);
    done();
  }

  async function loadMorePosts() {
    if (!profile || loadingMorePosts) return;
    setLoadingMorePosts(true);
    const { data: more } = await supabase
      .from("posts")
      .select("*, post_media(*)")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .order("position", { foreignTable: "post_media", ascending: true })
      .range(posts.length, posts.length + PROFILE_PAGE_SIZE - 1);
    setPosts((prev) => {
      const known = new Set(prev.map((x) => x.id));
      return [...prev, ...attachOwnerProfile(more ?? [], profile).filter((x) => !known.has(x.id))];
    });
    setHasMorePosts((more ?? []).length === PROFILE_PAGE_SIZE);
    setLoadingMorePosts(false);
  }

  async function handleReportUser(category: string, details: string) {
    if (!profile) return;
    await submitReport({
      targetType: "user",
      reportedUserId: profile.id,
      category,
      details,
      evidence: [profile.display_name, profile.bio].filter(Boolean).join(" — ") || null,
      evidenceUrl: profile.avatar_url ?? null,
    });
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
      router.push(`/chat/${conversationId}`);
    } catch (err) {
      const message = getErrorMessage(err);
      // Raised by the database (enforce_conversation_join_rules) — already
      // phrased for the reader, so show it as-is instead of a generic error.
      setError(message.includes("only accepts messages") ? message : getErrorMessage(err));
    }
  }

  async function handleBlock() {
    if (!profile) return;
    setMenuOpen(false);
    try {
      await blockUser(profile.id);
      setBlocked((b) => ({ ...b, blockedByMe: true }));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleUnblock() {
    if (!profile) return;
    setMenuOpen(false);
    try {
      await unblockUser(profile.id);
      setBlocked((b) => ({ ...b, blockedByMe: false }));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const header = (
    <header
      className={`safe-top sticky top-0 z-30 flex items-center gap-3 px-3 py-3 transition-colors duration-200 ${
        scrollProgress > 0.05 ? "glass-header" : "border-b border-transparent"
      }`}
    >
      <button onClick={() => router.back()} aria-label="Back" className="shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* The big avatar below shrinks/fades as you scroll; this mini avatar
          fades in at the same rate right where it "lands", so the profile
          picture reads as one continuous liquid-glass motion into the header. */}
      <div
        className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-brand-gradient transition-transform"
        style={{
          opacity: scrollProgress,
          transform: `scale(${0.6 + 0.4 * scrollProgress})`,
        }}
      >
        {profile?.avatar_url && <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />}
      </div>

      <div className="relative min-w-0 flex-1">
        <h1
          className="absolute inset-0 flex items-center truncate text-lg font-bold transition-opacity"
          style={{ opacity: 1 - scrollProgress }}
        >
          Profile
        </h1>
        <p
          className="absolute inset-0 flex items-center truncate text-sm font-bold transition-opacity"
          style={{ opacity: scrollProgress }}
        >
          {profile?.display_name || profile?.username}
        </p>
      </div>
    </header>
  );

  if (loading) {
    return (
      <>
        {header}
        <ProfileSkeleton />
      </>
    );
  }
  if (!profile) {
    return (
      <>
        {header}
        <p className="px-4 py-16 text-center text-sm text-ink-muted">Profile not found.</p>
      </>
    );
  }

  const isLockedForViewer = !!profile?.is_locked && !isSelf && relation !== "following";

  return (
    <div className="pb-8">
      {header}
      <div
        className="flex flex-col items-center px-4 pt-6 transition-transform duration-100"
        style={{
          transform: `scale(${1 - 0.12 * scrollProgress})`,
          opacity: 1 - 0.85 * scrollProgress,
          transformOrigin: "top center",
        }}
      >
        {!isSelf && (
          <div className="relative mb-2 ml-auto mr-0 self-end">
            <button onClick={() => setMenuOpen((o) => !o)} className="p-1 text-ink-muted" aria-label="Profile options">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-7 z-10 w-40 overflow-hidden rounded-xl2 glass-card shadow-lg">
                <button
                  onClick={() => { setMenuOpen(false); setReportingUser(true); }}
                  className="w-full border-b border-black/5 px-3 py-2.5 text-left text-sm font-medium dark:border-white/5"
                >
                  Report user
                </button>
                {blocked.blockedByMe ? (
                  <button onClick={handleUnblock} className="w-full px-3 py-2.5 text-left text-sm font-medium">
                    Unblock
                  </button>
                ) : (
                  <button onClick={() => { setMenuOpen(false); setConfirmingBlock(true); }} className="w-full px-3 py-2.5 text-left text-sm font-medium text-red-500">
                    Block
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => setAvatarSheetOpen(true)}
          aria-label="Profile picture options"
          className={hasActiveStory ? "rounded-full bg-brand-gradient p-0.5" : ""}
        >
          <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-surface-lightMuted bg-brand-gradient dark:border-surface-darkMuted">
            {profile.avatar_url && <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />}
          </div>
        </button>

        <h2 className="mt-3 flex items-center gap-1.5 text-lg font-bold">
          {profile.display_name ?? profile.username}
          {profile.is_verified && <VerifiedBadge size={16} />}
          {profile.is_locked && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-muted" aria-label="Private account">
              <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" strokeLinecap="round" />
            </svg>
          )}
          {isSelf && (
            <button onClick={() => router.push("/profile/edit")} aria-label="Edit account" className="text-ink-muted">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </h2>
        <p className="text-sm text-ink-muted">@{profile.username}</p>
        {profile.bio && (
          <p className="mt-2 max-w-xs text-center text-sm">
            <ReadMoreText text={profile.bio} limit={100} />
          </p>
        )}
        {profile.location && <p className="mt-1 text-xs text-ink-muted">📍 {profile.location}</p>}

        {(profile.business_email || profile.business_link) && (
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
            {profile.business_email && (
              <a
                href={`mailto:${profile.business_email}`}
                className="rounded-full bg-black/5 px-3 py-1.5 text-xs font-semibold dark:bg-white/10"
              >
                ✉️ Email
              </a>
            )}
            {profile.business_link && (
              <a
                href={profile.business_link}
                target="_blank"
                rel="noopener noreferrer"
                className="max-w-[200px] truncate rounded-full bg-black/5 px-3 py-1.5 text-xs font-semibold dark:bg-white/10"
              >
                {profile.business_link_type === "mylinks"
                  ? "🔗 My Links"
                  : `🌐 ${profile.business_link.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "")}`}
              </a>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center gap-6">
          <button onClick={() => setFollowListMode("followers")} className="flex flex-col items-center">
            <span className="text-base font-bold">{followerCount}</span>
            <span className="text-xs text-ink-muted">Fans</span>
          </button>
          <button onClick={() => setFollowListMode("following")} className="flex flex-col items-center">
            <span className="text-base font-bold">{followingCount}</span>
            <span className="text-xs text-ink-muted">Following</span>
          </button>
          <div className="flex flex-col items-center">
            <span className="text-base font-bold">{likeCount}</span>
            <span className="text-xs text-ink-muted">Likes</span>
          </div>
        </div>

        {!isSelf && blocked.blockedMe && (
          <p className="mt-4 text-sm text-ink-muted">This profile isn't available.</p>
        )}

        {!isSelf && !blocked.blockedMe && !blocked.blockedByMe && (
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

        {!isSelf && blocked.blockedByMe && (
          <p className="mt-4 text-sm text-ink-muted">You've blocked this user.</p>
        )}

        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </div>

      {!blocked.blockedMe && isLockedForViewer && (
        <div className="mt-10 flex flex-col items-center px-8 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-black/5 dark:bg-white/10">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-ink-muted">
              <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" strokeLinecap="round" />
            </svg>
          </div>
          <p className="mt-3 text-sm font-bold">This account is private</p>
          <p className="mt-1 text-sm text-ink-muted">
            Follow @{profile.username} to see their posts and stories.
          </p>
        </div>
      )}

      {!blocked.blockedMe && !isLockedForViewer && (
        <>
          <div className="mt-6 grid grid-cols-3 gap-0.5 px-0.5">
            {posts.map((post) => (
              <button
                key={post.id}
                onClick={() => setSelectedPost(post)}
                className="aspect-square overflow-hidden bg-black/5 dark:bg-white/5"
              >
                {post.media_type === "text" ? (
                  <div className="flex h-full w-full items-center justify-center bg-brand-gradient p-2 text-center text-[10px] text-white">
                    {post.text_content?.slice(0, 40)}
                  </div>
                ) : (
                  <img src={post.thumbnail_url ?? post.media_url ?? ""} alt="" className="h-full w-full object-cover" />
                )}
              </button>
            ))}
          </div>

          {posts.length === 0 && <p className="mt-10 text-center text-sm text-ink-muted">No posts yet.</p>}

          {hasMorePosts && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={loadMorePosts}
                disabled={loadingMorePosts}
                className="rounded-full bg-black/5 px-5 py-2 text-sm font-semibold disabled:opacity-50 dark:bg-white/10"
              >
                {loadingMorePosts ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}

      {selectedPost && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 px-3 py-8" onClick={() => setSelectedPost(null)}>
          <div className="mx-auto max-w-lg" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedPost(null)} className="mb-2 block text-sm font-semibold text-white">
              ✕ Close
            </button>
            <PostCard
              post={selectedPost}
              onDeleted={(id) => {
                setPosts((prev) => prev.filter((p) => p.id !== id));
                setSelectedPost(null);
              }}
            />
          </div>
        </div>
      )}

      {followListMode && profile && (
        <FollowListSheet
          userId={profile.id}
          mode={followListMode}
          isSelf={isSelf}
          onClose={() => setFollowListMode(null)}
        />
      )}

      {reportingUser && profile && (
        <ReportSheet
          title={`Report @${profile.username}`}
          onSubmit={handleReportUser}
          onClose={() => setReportingUser(false)}
        />
      )}

      {confirmingBlock && profile && (
        <ConfirmModal
          title={`Block ${profile.username}?`}
          message="They won't be able to message or follow you."
          confirmLabel="Block"
          danger
          onConfirm={() => { setConfirmingBlock(false); handleBlock(); }}
          onCancel={() => setConfirmingBlock(false)}
        />
      )}

      {avatarSheetOpen && (
        <AvatarActionSheet
          hasStory={hasActiveStory}
          onViewPhoto={() => { setAvatarSheetOpen(false); setViewingPhoto(true); }}
          onViewStatus={() => { setAvatarSheetOpen(false); setViewingStatus(true); }}
          onClose={() => setAvatarSheetOpen(false)}
        />
      )}

      {viewingPhoto && profile.avatar_url && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
          onClick={() => setViewingPhoto(false)}
        >
          <img src={profile.avatar_url} alt="" className="max-h-[85vh] max-w-[92vw] object-contain" />
          <button onClick={() => setViewingPhoto(false)} className="absolute right-4 top-5 text-white">✕</button>
        </div>
      )}

      {viewingStatus && activeStories.length > 0 && (
        <StoryViewer
          stories={activeStories}
          username={profile.display_name ?? profile.username}
          onClose={() => setViewingStatus(false)}
        />
      )}
    </div>
  );
}
