"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useTopLoading } from "./TopLoadingBar";
import { ConversationListSkeleton } from "./Skeleton";
import { isOnline } from "@/lib/presence";
import { hideConversation, reportConversation } from "@/lib/conversationActions";
import { ensureAiConversation, AI_BOT_USERNAME } from "@/lib/aiBot";
import { blockUser } from "@/lib/block";
import ConversationActionSheet from "./ConversationActionSheet";

interface ConversationSummary {
  id: string;
  title: string | null;
  is_group: boolean;
  other_id: string | null;
  other_username: string | null;
  other_avatar: string | null;
  other_last_seen_at: string | null;
  preview: string;
  activityAt: string | null;
  hiddenAt: string | null;
}

let cachedConversations: ConversationSummary[] | null = null;

// How far a row can be dragged before it's fully "revealed" (sticks open).
const REVEAL_MAX = 84;
const REVEAL_THRESHOLD = 48;

export default function ConversationList() {
  const { start, done } = useTopLoading();
  const [conversations, setConversations] = useState<ConversationSummary[]>(cachedConversations ?? []);
  const [loading, setLoading] = useState(cachedConversations === null);
  const [, forceTick] = useState(0); // ages out online dots over time

  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [swipeId, setSwipeId] = useState<string | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeLockedRef = useRef(false);

  const [sheetFor, setSheetFor] = useState<ConversationSummary | null>(null);

  useEffect(() => {
    load();
    const tick = setInterval(() => forceTick((t) => t + 1), 15_000);
    return () => clearInterval(tick);
  }, []);

  async function buildSummary(row: any, user: { id: string }): Promise<ConversationSummary | null> {
    const convo = row.conversations;
    if (!convo) return null;

    const [{ data: others }] = await Promise.all([
      supabase
        .from("conversation_participants")
        .select("user_id, profiles!conversation_participants_user_id_fkey(username, avatar_url, last_seen_at)")
        .eq("conversation_id", convo.id)
        .neq("user_id", user.id)
        .limit(1),
    ]);
    const otherRow = others?.[0] as any;
    const other = otherRow?.profiles;

    const messages = (convo.messages ?? []).sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const lastMessage = messages[0];

    let latestReaction: any = null;
    if (messages.length > 0) {
      const { data: reactionRows } = await supabase
        .from("message_reactions")
        .select("emoji, created_at, user_id, message_id, profiles!message_reactions_user_id_fkey(username)")
        .in("message_id", messages.map((m: any) => m.id))
        .order("created_at", { ascending: false })
        .limit(1);
      latestReaction = reactionRows?.[0] ?? null;
    }

    let preview = "Say hello 👋";
    let activityAt: string | null = lastMessage?.created_at ?? null;

    if (lastMessage) {
      preview = lastMessage.content ?? (lastMessage.media_url ? "📷 Sent a photo" : "Say hello 👋");
    }

    if (latestReaction && (!lastMessage || new Date(latestReaction.created_at) > new Date(lastMessage.created_at))) {
      const reactedToOwnMessage = messages.find((m: any) => m.id === latestReaction.message_id)?.sender_id === user.id;
      preview = reactedToOwnMessage
        ? `${latestReaction.profiles?.username ?? "Someone"} reacted ${latestReaction.emoji} to your message`
        : `You reacted ${latestReaction.emoji}`;
      activityAt = latestReaction.created_at;
    }

    // Soft-deleted by this user, and nothing has happened since — stays
    // hidden. Any newer activity brings it back, same as WhatsApp.
    if (row.hidden_at && (!activityAt || new Date(activityAt) <= new Date(row.hidden_at))) {
      return null;
    }

    return {
      id: convo.id,
      title: convo.title,
      is_group: convo.is_group,
      other_id: otherRow?.user_id ?? null,
      other_username: other?.username ?? null,
      other_avatar: other?.avatar_url ?? null,
      other_last_seen_at: other?.last_seen_at ?? null,
      preview,
      activityAt,
      hiddenAt: row.hidden_at ?? null,
    };
  }

  async function load() {
    start();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await ensureAiConversation();

      const { data, error } = await supabase
        .from("conversation_participants")
        .select(
          `
          conversation_id,
          hidden_at,
          conversations (
            id, title, is_group,
            messages ( id, content, media_url, created_at, sender_id )
          )
        `
        )
        .eq("user_id", user.id);

      if (error) {
        console.error("Failed to load conversations:", error.message);
        return;
      }

      // Build every conversation's summary concurrently instead of one at a
      // time — this was the slowest part of loading the chat list.
      const summaries = (
        await Promise.all((data ?? []).map((row: any) => buildSummary(row, user)))
      ).filter((s): s is ConversationSummary => s !== null);

      summaries.sort((a, b) => {
        if (!a.activityAt && !b.activityAt) return 0;
        if (!a.activityAt) return 1;
        if (!b.activityAt) return -1;
        return new Date(b.activityAt).getTime() - new Date(a.activityAt).getTime();
      });

      cachedConversations = summaries;
      setConversations(summaries);
    } finally {
      setLoading(false);
      done();
    }
  }

  function handleRowTouchStart(c: ConversationSummary, e: React.TouchEvent) {
    // A second finger landing while a different row is revealed shouldn't
    // start tracking a fresh swipe on top of it.
    if (revealedId && revealedId !== c.id) {
      setRevealedId(null);
      return;
    }
    const t = e.touches[0];
    swipeStartRef.current = { x: t.clientX, y: t.clientY };
    swipeLockedRef.current = false;
  }
  function handleRowTouchMove(c: ConversationSummary, e: React.TouchEvent) {
    const start = swipeStartRef.current;
    if (!start) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    if (!swipeLockedRef.current) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        swipeStartRef.current = null;
        return;
      }
      swipeLockedRef.current = true;
    }

    setSwipeId(c.id);
    setSwipeX(dx > 0 ? Math.min(dx, REVEAL_MAX) : 0);
  }
  function handleRowTouchEnd(c: ConversationSummary) {
    const committed = swipeLockedRef.current;
    swipeStartRef.current = null;
    swipeLockedRef.current = false;
    if (committed && swipeId === c.id) {
      setRevealedId(swipeX >= REVEAL_THRESHOLD ? c.id : null);
    }
    setSwipeId(null);
    setSwipeX(0);
  }

  async function handleDelete() {
    if (!sheetFor) return;
    const id = sheetFor.id;
    setSheetFor(null);
    setRevealedId(null);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    await hideConversation(id);
  }
  async function handleBlockAndDelete() {
    if (!sheetFor) return;
    const { id, other_id } = sheetFor;
    setSheetFor(null);
    setRevealedId(null);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (other_id) await blockUser(other_id);
    await hideConversation(id);
  }
  async function handleReport(reason: string) {
    if (!sheetFor || !sheetFor.other_id) return;
    const { id, other_id } = sheetFor;
    setSheetFor(null);
    setRevealedId(null);
    await reportConversation(id, other_id, reason);
  }

  if (loading) return <ConversationListSkeleton />;

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 px-6 py-16 text-center text-ink-muted">
        <p className="font-semibold">No conversations yet</p>
        <p className="text-sm">Message a friend or family member you've met on Next Social.</p>
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y divide-black/5 dark:divide-white/5">
        {conversations.map((c) => {
          const isBot = c.other_username === AI_BOT_USERNAME;
          const offset = isBot ? 0 : revealedId === c.id ? REVEAL_MAX : swipeId === c.id ? swipeX : 0;
          return (
            <li key={c.id} className="relative overflow-hidden">
              {!isBot && (
              <button
                onClick={() => setSheetFor(c)}
                aria-label="Delete conversation"
                className="absolute inset-y-0 left-0 flex w-[84px] flex-col items-center justify-center gap-1 bg-red-500 text-white"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[11px] font-medium">Delete</span>
              </button>
              )}

              <div
                onTouchStart={(e) => !isBot && handleRowTouchStart(c, e)}
                onTouchMove={(e) => !isBot && handleRowTouchMove(c, e)}
                onTouchEnd={() => !isBot && handleRowTouchEnd(c)}
                style={{
                  transform: `translateX(${offset}px)`,
                  transition: swipeId === c.id ? "none" : "transform 150ms ease-out",
                }}
                className="relative bg-surface-light dark:bg-surface-dark"
              >
                <Link
                  href={`/chat/${c.id}`}
                  onClick={(e) => {
                    if (revealedId === c.id) {
                      e.preventDefault();
                      setRevealedId(null);
                    }
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <div className="relative h-11 w-11 shrink-0">
                    <div className="h-11 w-11 overflow-hidden rounded-full bg-brand-gradient">
                      {c.other_avatar && <img src={c.other_avatar} alt="" className="h-full w-full object-cover" />}
                    </div>
                    {isOnline(c.other_last_seen_at) && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface-light bg-green-500 dark:border-surface-dark" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{c.title ?? c.other_username ?? "Conversation"}</p>
                    <p className="truncate text-xs text-ink-muted">{c.preview}</p>
                  </div>
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      {sheetFor && (
        <ConversationActionSheet
          username={sheetFor.other_username ?? sheetFor.title ?? "this conversation"}
          onDelete={handleDelete}
          onBlockAndDelete={handleBlockAndDelete}
          onReport={handleReport}
          onClose={() => setSheetFor(null)}
        />
      )}
    </>
  );
}
