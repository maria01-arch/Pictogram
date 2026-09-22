import { supabase } from "./supabaseClient";
import { getUserLocal } from "@/lib/authUser";

export async function getUnreadNotificationCount(): Promise<number> {
  const { data: { user } } = await getUserLocal();
  if (!user) return 0;
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);
  return count ?? 0;
}

export async function getPendingFollowRequestCount(): Promise<number> {
  const { data: { user } } = await getUserLocal();
  if (!user) return 0;
  const { count } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", user.id)
    .eq("status", "pending");
  return count ?? 0;
}

// Number of conversations with something unread ("people that text you").
// One database call instead of one query per conversation.
export async function getUnreadConversationCount(): Promise<number> {
  const { data: { user } } = await getUserLocal();
  if (!user) return 0;
  const { data, error } = await supabase.rpc("unread_conversation_count");
  if (error) return 0;
  return Number(data ?? 0);
}

export async function markConversationRead(conversationId: string) {
  const { data: { user } } = await getUserLocal();
  if (!user) return;
  await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
}
