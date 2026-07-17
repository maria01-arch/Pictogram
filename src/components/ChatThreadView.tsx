"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { Message, Profile } from "@/types/database";

export default function ChatThreadView({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    init();
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
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function sendMessage() {
    const content = draft.trim();
    if (!content || !userId) return;
    setDraft("");

    // Optimistic append — don't rely solely on the realtime channel, which
    // requires replication to be enabled per-table in Supabase and can
    // otherwise make a just-sent message seem to "disappear."
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
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-black/5 px-3 py-2.5 dark:border-white/5">
        <button onClick={() => router.back()} aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {otherProfile && (
          <Link href={`/profile/${otherProfile.username}`} className="flex flex-1 items-center gap-2.5">
            <div className="h-9 w-9 overflow-hidden rounded-full bg-brand-gradient">
              {otherProfile.avatar_url && (
                <img src={otherProfile.avatar_url} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <p className="text-sm font-semibold">{otherProfile.username}</p>
          </Link>
        )}
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3 no-scrollbar">
        {messages.map((m) => {
          const mine = m.sender_id === userId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
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

      <div className="flex items-center gap-2 border-t border-black/5 px-3 py-2 dark:border-white/5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Message…"
          className="flex-1 rounded-full bg-black/5 px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-from dark:bg-white/10"
        />
        <button
          onClick={sendMessage}
          disabled={!draft.trim()}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-gradient text-white disabled:opacity-40"
          aria-label="Send message"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
