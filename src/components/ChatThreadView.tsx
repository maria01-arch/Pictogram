"use client";

import { useEffect, useRef, useState } from "react";
import { useViewportHeight } from "@/lib/useViewportHeight";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { Message, Profile } from "@/types/database";
import type { RealtimeChannel } from "@supabase/supabase-js";

const TYPING_TIMEOUT_MS = 2500;

export default function ChatThreadView({ conversationId }: { conversationId: string }) {
  useViewportHeight();
  const router = useRouter();
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const otherTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    init().then((fn) => { cleanup = fn; });
    return () => cleanup?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: participants } = await supabase
      .from("conversation_participants")
      .select("user_id, profiles!conversation_participants_user_id_fkey(*)")
      .eq("conversation_id", conversationId);

    const other = (participants ?? []).find((p: any) => p.user_id !== user.id);
    if (other) setOtherProfile((other as any).profiles);

    const { data: msgs } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setMessages(msgs ?? []);

    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
        }
      )
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload.userId === user.id) return; // ignore our own broadcast
        setOtherTyping(true);
        if (otherTypingTimeoutRef.current) clearTimeout(otherTypingTimeoutRef.current);
        otherTypingTimeoutRef.current = setTimeout(() => setOtherTyping(false), TYPING_TIMEOUT_MS);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (otherTypingTimeoutRef.current) clearTimeout(otherTypingTimeoutRef.current);
    };
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function handleDraftChange(value: string) {
    setDraft(value);
    if (!userId || !channelRef.current) return;

    channelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { userId },
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {}, TYPING_TIMEOUT_MS);
  }

  async function sendMessage() {
    const content = draft.trim();
    if (!content || !userId) return;
    setDraft("");

    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage: Message = {
      id: optimisticId,
      conversation_id: conversationId,
      sender_id: userId,
      content,
      media_url: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: userId, content })
      .select("*")
      .single();

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      return;
    }

    setMessages((prev) => prev.map((m) => (m.id === optimisticId ? data : m)));
  }

  return (
    <div className="flex flex-col" style={{ height: "var(--app-height, 100dvh)" }}>
      <header className="flex shrink-0 items-center gap-2.5 border-b border-black/5 px-3 py-2 dark:border-white/5">
        <button onClick={() => router.back()} aria-label="Back" className="shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {otherProfile && (
          <Link href={`/profile/${otherProfile.username}`} className="flex flex-1 items-center gap-2 overflow-hidden">
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-brand-gradient">
              {otherProfile.avatar_url && (
                <img src={otherProfile.avatar_url} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{otherProfile.username}</p>
              {otherTyping && <p className="text-[11px] text-brand-from">typing…</p>}
            </div>
          </Link>
        )}
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2.5 no-scrollbar">
        {messages.map((m) => {
          const mine = m.sender_id === userId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] select-none break-words rounded-2xl px-4 py-2.5 text-[15px] leading-snug ${
                  mine ? "bg-brand-gradient text-white" : "bg-black/5 dark:bg-white/10"
                }`}
              >
                {m.content}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-black/5 px-2.5 py-2 dark:border-white/5">
        <input
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Message…"
          className="flex-1 rounded-full bg-black/5 px-3.5 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-from dark:bg-white/10"
        />
        <button
          onClick={sendMessage}
          disabled={!draft.trim()}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-gradient text-white disabled:opacity-40"
          aria-label="Send message"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
