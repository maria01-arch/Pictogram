"use client";

import { useEffect, useState } from "react";
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

export default function ConversationList({
  activeId,
  onSelect,
}: {
  activeId: string | null;
  onSelect: (conversationId: string) => void;
}) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return setLoading(false);

      // Conversations the current user participates in, with the other
      // participant's profile and the most recent message preview.
      const { data, error } = await supabase
        .from("conversation_participants")
        .select(
          `
          conversation_id,
          conversations (
            id, title, is_group,
            messages ( content, created_at, sender_id, profiles ( username, avatar_url ) )
          )
        `
        )
        .eq("user_id", user.id);

      if (error) {
        console.error("Failed to load conversations:", error.message);
        setLoading(false);
        return;
      }

      const summaries: ConversationSummary[] = (data ?? []).map((row: any) => {
        const convo = row.conversations;
        const messages = (convo?.messages ?? []).sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const last = messages[0];
        return {
          id: convo.id,
          title: convo.title,
          is_group: convo.is_group,
          other_username: last?.profiles?.username ?? null,
          other_avatar: last?.profiles?.avatar_url ?? null,
          last_message: last?.content ?? null,
          last_message_at: last?.created_at ?? null,
        };
      });

      setConversations(summaries);
      setLoading(false);
    }

    load();
  }, []);

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
          <button
            onClick={() => onSelect(c.id)}
            className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
              activeId === c.id ? "bg-brand-from/10" : "hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-brand-gradient">
              {c.other_avatar && (
                <img src={c.other_avatar} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {c.title ?? c.other_username ?? "Conversation"}
              </p>
              <p className="truncate text-xs text-ink-muted">{c.last_message ?? "Say hello 👋"}</p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
