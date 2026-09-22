import { supabase } from "./supabaseClient";
import { getUserLocal } from "@/lib/authUser";

export const AI_BOT_USERNAME = "ai_assistant";

async function getBotId(): Promise<string | null> {
  const res = await fetch("/api/ai/bot");
  if (!res.ok) return null;
  const data = await res.json();
  return data.id ?? null;
}

// Finds (or creates) the user's 1:1 conversation with the AI assistant.
let aiConversationPromise: Promise<string | null> | null = null;

// Memoized: the chat list used to run 3+ queries for this on every visit.
export function ensureAiConversation(): Promise<string | null> {
  if (!aiConversationPromise) {
    aiConversationPromise = ensureAiConversationUncached().then((id) => {
      if (!id) aiConversationPromise = null; // failed — allow a retry next time
      return id;
    });
  }
  return aiConversationPromise;
}

async function ensureAiConversationUncached(): Promise<string | null> {
  const {
    data: { user },
  } = await getUserLocal();
  if (!user) return null;

  const botId = await getBotId();
  if (!botId) return null;

  const { data: mine } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", user.id);

  if (mine && mine.length > 0) {
    const { data: botRow } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", botId)
      .in(
        "conversation_id",
        mine.map((m) => m.conversation_id)
      )
      .maybeSingle();
    if (botRow) return botRow.conversation_id;
  }

  const { data: convo, error } = await supabase.from("conversations").insert({ is_group: false }).select("id").single();
  if (error || !convo) return null;

  // Two separate inserts on purpose — the RLS policy for adding a second
  // participant only allows it once the requesting user is already a
  // participant themselves, so our own row has to land first.
  await supabase.from("conversation_participants").insert({ conversation_id: convo.id, user_id: user.id });
  await supabase.from("conversation_participants").insert({ conversation_id: convo.id, user_id: botId });

  return convo.id;
}
