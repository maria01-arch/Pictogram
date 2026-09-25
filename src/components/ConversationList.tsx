"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useTopLoading } from "./TopLoadingBar";
import { ConversationListSkeleton } from "./Skeleton";
import { isOnline } from "@/lib/presence";
import { isVoiceNotePath } from "@/lib/uploadChatVoice";
import { isChatVideoPath } from "@/lib/uploadChatVideo";
import { hideConversation, reportConversation } from "@/lib/conversationActions";
import { ensureAiConversation, AI_BOT_USERNAME } from "@/lib/aiBot";
import { blockUser } from "@/lib/block";
import ConversationActionSheet from "./ConversationActionSheet";
import { getUserLocal } from "@/lib/authUser";

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

  // One database call (my_conversations) returns every chat with its last message,
  // latest reaction and hidden/sorted state — it used to download every message
  // of every conversation and then run extra queries per chat.
  function toSummary(row: any): ConversationSummary {
    let preview = "Say hello 👋";
    let activityAt: string | null = row.last_message_at ?? null;

    if (row.last_message_at) {
      preview =
        row.last_content ??
        (row.last_media_url
          ? isVoiceNotePath(row.last_media_url)
            ? "🎤 Voice message"
            : isChatVideoPath(row.last_media_url)
              ? "📹 Sent a video"
              : "📷 Sent a photo"
          : "Say hello 👋");
    }

    if (row.reaction_emoji && (!row.last_message_at || new Date(row.reaction_at) > new Date(row.last_message_at))) {
      preview = row.reaction_on_mine
        ? `${row.reaction_username ?? "Someone"} reacted ${row.reaction_emoji} to your message`
        : `You reacted ${row.reaction_emoji}`;
      activityAt = row.reaction_at;
    }

    return {
      id: row.conversation_id,
      title: row.title,
      is_group: row.is_group,
      other_id: row.other_id ?? null,
      other_username: row.other_username ?? null,
      other_avatar: row.other_avatar ?? null,
      other_last_seen_at: row.other_last_seen_at ?? null,
      preview,
      activityAt,
      hiddenAt: row.hidden_at ?? null,
    };
  }

  async function load() {
    start();
    try {
      const { data: { user } } = await getUserLocal();
      if (!user) return;

      await ensureAiConversation();

      const { data, error } = await supabase.rpc("my_conversations");
      if (error) {
        console.error("Failed to load conversations:", error.message);
        return;
      }

      const summaries = (data ?? []).map((row: any) => toSummary(row));
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
                      {c.other_avatar && <img src={c.other_avatar} alt="" loading="lazy" className="h-full w-full object-cover" />}
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
