"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

interface ConversationSummary {
  id: string;
  title: string | null;
  is_group: boolean;
  other_username: string | null;
  other_avatar: string | null;
  last_message: string | null;
  last_message_at: string | null;
}

export default function ConversationList() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setLoading(false);

    const { data, error } = await supabase
      .from("conversation_participants")
      .select(
        `
        conversation_id,
        conversations (
          id, title, is_group,
          messages ( content, created_at, sender_id )
        )
      `
      )
      .eq("user_id", user.id);

    if (error) {
      console.error("Failed to load conversations:", error.message);
      setLoading(false);
      return;
    }

    const summaries: ConversationSummary[] = [];
    for (const row of (data ?? []) as any[]) {
      const convo = row.conversations;
      if (!convo) continue;

      const { data: others } = await supabase
        .from("conversation_participants")
        .select("profiles!conversation_participants_user_id_fkey(username, avatar_url)")
        .eq("conversation_id", convo.id)
        .neq("user_id", user.id)
        .limit(1);

      const other = (others?.[0] as any)?.profiles;
      const messages = (convo.messages ?? []).sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      summaries.push({
        id: convo.id,
        title: convo.title,
        is_group: convo.is_group,
        other_username: other?.username ?? null,
        other_avatar: other?.avatar_url ?? null,
        last_message: messages[0]?.content ?? null,
        last_message_at: messages[0]?.created_at ?? null,
      });
    }

    // Newest activity first — conversations with no messages yet sink to the bottom.
    summaries.sort((a, b) => {
      if (!a.last_message_at && !b.last_message_at) return 0;
      if (!a.last_message_at) return 1;
      if (!b.last_message_at) return -1;
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    });

    setConversations(summaries);
    setLoading(false);
  }

  if (loading) {
    return <div className="p-4 text-sm text-ink-muted">Loading chats…</div>;
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 px-6 py-16 text-center text-ink-muted">
        <p className="font-semibold">No conversations yet</p>
        <p className="text-sm">Message a friend or family member you've met on Pictogram.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-black/5 dark:divide-white/5">
      {conversations.map((c) => (
        <li key={c.id}>
          <Link href={`/chat/${c.id}`} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-black/5 dark:hover:bg-white/5">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-brand-gradient">
              {c.other_avatar && <img src={c.other_avatar} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{c.title ?? c.other_username ?? "Conversation"}</p>
              <p className="truncate text-xs text-ink-muted">{c.last_message ?? "Say hello 👋"}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
