"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getErrorMessage } from "@/lib/errorMessage";
import type { Comment } from "@/types/database";

export default function CommentsSheet({ postId, onClose }: { postId: string; onClose: () => void }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    load();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [postId]);

  async function load() {
    const { data } = await supabase
      .from("comments")
      .select("*, profiles!comments_user_id_fkey(username, avatar_url)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    setComments(data ?? []);
    setLoading(false);
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
    load();
  }

  async function remove(commentId: string) {
    if (!confirm("Delete this comment?")) return;
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (error) return setError(getErrorMessage(error));
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  return (
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
          {comments.map((c) => (
            <div key={c.id} className="mb-3 flex items-start gap-2.5">
              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-brand-gradient">
                {c.profiles?.avatar_url && <img src={c.profiles.avatar_url} alt="" className="h-full w-full object-cover" />}
              </div>
              <p className="flex-1 text-sm">
                <span className="mr-1.5 font-semibold">{c.profiles?.username}</span>
                {c.content}
              </p>
              {c.user_id === userId && (
                <button onClick={() => remove(c.id)} className="shrink-0 text-xs text-red-500">
                  Delete
                </button>
              )}
            </div>
          ))}
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
    </div>
  );
}
