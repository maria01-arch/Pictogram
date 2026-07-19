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
  preview: string;
  activityAt: string | null;
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
          messages ( id, content, media_url, created_at, sender_id )
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

      summaries.push({
        id: convo.id,
        title: convo.title,
        is_group: convo.is_group,
        other_username: other?.username ?? null,
        other_avatar: other?.avatar_url ?? null,
        preview,
        activityAt,
      });
    }

    summaries.sort((a, b) => {
      if (!a.activityAt && !b.activityAt) return 0;
      if (!a.activityAt) return 1;
      if (!b.activityAt) return -1;
      return new Date(b.activityAt).getTime() - new Date(a.activityAt).getTime();
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
              <p className="truncate text-xs text-ink-muted">{c.preview}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
