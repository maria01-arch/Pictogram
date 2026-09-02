"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getErrorMessage } from "@/lib/errorMessage";
import { createNotification } from "@/lib/notifications";
import VerifiedBadge from "./VerifiedBadge";
import ReadMoreText from "./ReadMoreText";
import ConfirmModal from "./ConfirmModal";
import type { Comment, CommentReaction } from "@/types/database";
import Portal from "./Portal";
import { useScrollLock } from "@/lib/useScrollLock";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export default function CommentsSheet({ postId, postOwnerId, onClose }: { postId: string; postOwnerId?: string; onClose: () => void }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [reactions, setReactions] = useState<CommentReaction[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [pickerForId, setPickerForId] = useState<string | null>(null);
  useScrollLock();

  useEffect(() => {
    load();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [postId]);

  async function load() {
    const { data: commentRows } = await supabase
      .from("comments")
      .select("*, profiles!comments_user_id_fkey(username, avatar_url, is_verified)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    setComments(commentRows ?? []);
    setLoading(false);

    const ids = (commentRows ?? []).map((c) => c.id);
    if (ids.length === 0) {
      setReactions([]);
      return;
    }
    const { data: allReactions } = await supabase.from("comment_reactions").select("*").in("comment_id", ids);
    setReactions(allReactions ?? []);
  }

  async function submit() {
    const content = draft.trim();
    if (!content) return;
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setError("You must be signed in to comment.");

    setDraft("");
    const { error } = await supabase.from("comments").insert({ post_id: postId, user_id: user.id, content });
    if (error) return setError(getErrorMessage(error));

    if (postOwnerId) {
      const { data: me } = await supabase.from("profiles").select("username").eq("id", user.id).single();
      createNotification({
        targetUserId: postOwnerId,
        type: "comment",
        postId,
        pushTitle: "New comment",
        pushBody: `${me?.username ?? "Someone"} commented on your post`,
      });
    }

    load();
  }

  async function remove(commentId: string) {
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (error) return setError(getErrorMessage(error));
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  async function toggleReaction(commentId: string, emoji: string) {
    if (!userId) return;
    setPickerForId(null);
    const existing = reactions.find((r) => r.comment_id === commentId && r.user_id === userId);

    if (existing && existing.emoji === emoji) {
      setReactions((prev) => prev.filter((r) => !(r.comment_id === commentId && r.user_id === userId)));
      await supabase.from("comment_reactions").delete().eq("comment_id", commentId).eq("user_id", userId);
      return;
    }

    setReactions((prev) => [
      ...prev.filter((r) => !(r.comment_id === commentId && r.user_id === userId)),
      { comment_id: commentId, user_id: userId, emoji, created_at: new Date().toISOString() },
    ]);
    await supabase
      .from("comment_reactions")
      .upsert({ comment_id: commentId, user_id: userId, emoji }, { onConflict: "comment_id,user_id" });
  }

  function reactionsFor(commentId: string) {
    const grouped: Record<string, number> = {};
    reactions.filter((r) => r.comment_id === commentId).forEach((r) => {
      grouped[r.emoji] = (grouped[r.emoji] ?? 0) + 1;
    });
    return grouped;
  }

  return (
    <Portal>
    <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="max-h-[75vh] w-full rounded-t-2xl bg-surface-lightMuted dark:bg-surface-dark"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black/5 px-4 py-3 dark:border-white/5">
          <p className="text-sm font-semibold">Comments</p>
          <button onClick={onClose} className="text-ink-muted">✕</button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-4 py-3 no-scrollbar">
          {loading && <p className="text-sm text-ink-muted">Loading…</p>}
          {!loading && comments.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-muted">No comments yet. Say something!</p>
          )}
          {comments.map((c) => {
            const grouped = reactionsFor(c.id);
            const myReaction = reactions.find((r) => r.comment_id === c.id && r.user_id === userId)?.emoji;
            return (
              <div key={c.id} className="mb-3 flex items-start gap-2.5">
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-brand-gradient">
                  {c.profiles?.avatar_url && <img src={c.profiles.avatar_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="rounded-2xl bg-black/5 px-3 py-2 text-sm dark:bg-white/10">
                    <span className="mr-1.5 inline-flex items-center gap-1 font-semibold">{c.profiles?.username}{(c.profiles as any)?.is_verified && <VerifiedBadge size={12} />}</span>
                    <ReadMoreText text={c.content} limit={140} />
                  </div>

                  <div className="relative mt-1 flex flex-wrap items-center gap-1.5 px-1">
                    {Object.entries(grouped).map(([emoji, count]) => (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(c.id, emoji)}
                        className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs ${
                          myReaction === emoji ? "bg-brand-gradient text-white" : "bg-black/5 dark:bg-white/10"
                        }`}
                      >
                        <span>{emoji}</span>
                        <span>{count}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => setPickerForId(pickerForId === c.id ? null : c.id)}
                      className="text-xs font-medium text-ink-muted"
                    >
                      React
                    </button>

                    {pickerForId === c.id && (
                      <div className="absolute bottom-full left-0 z-10 mb-1 flex gap-1.5 rounded-full glass-card px-2.5 py-1.5 shadow-lg">
                        {QUICK_EMOJIS.map((emoji) => (
                          <button key={emoji} onClick={() => toggleReaction(c.id, emoji)} className="text-base">
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {c.user_id === userId && (
                  <button onClick={() => setConfirmingDeleteId(c.id)} className="shrink-0 text-xs text-red-500">
                    Delete
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="px-4 text-sm text-red-500">{error}</p>}

        <div className="flex items-center gap-2 border-t border-black/5 px-3 py-2 dark:border-white/5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Add a comment…"
            className="flex-1 rounded-full bg-black/5 px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-from dark:bg-white/10"
          />
          <button onClick={submit} disabled={!draft.trim()} className="text-sm font-semibold text-brand-from disabled:opacity-40">
            Post
          </button>
        </div>
      </div>

      {confirmingDeleteId && (
        <ConfirmModal
          title="Delete this comment?"
          confirmLabel="Delete"
          danger
          onConfirm={() => { const id = confirmingDeleteId; setConfirmingDeleteId(null); remove(id); }}
          onCancel={() => setConfirmingDeleteId(null)}
        />
      )}
    </div>
    </Portal>
  );
}
