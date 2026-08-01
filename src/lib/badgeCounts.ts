import { supabase } from "./supabaseClient";

export async function getUnreadNotificationCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);
  return count ?? 0;
}

export async function getPendingFollowRequestCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", user.id)
    .eq("status", "pending");
  return count ?? 0;
}

// Counts distinct conversations with a message newer than this user's
// last_read_at for that conversation (or never read at all) — "number of
// people that text" rather than a raw message count.
export async function getUnreadConversationCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data: participants } = await supabase
    .from("conversation_participants")
    .select("conversation_id, last_read_at")
    .eq("user_id", user.id);

  if (!participants || participants.length === 0) return 0;

  let unread = 0;
  await Promise.all(
    participants.map(async (p) => {
      let query = supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", p.conversation_id)
        .neq("sender_id", user.id);

      if (p.last_read_at) {
        query = query.gt("created_at", p.last_read_at);
      }

      const { count } = await query;
      if ((count ?? 0) > 0) unread += 1;
    })
  );

  return unread;
}

export async function markConversationRead(conversationId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
}
