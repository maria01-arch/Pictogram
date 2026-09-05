import { supabase } from "./supabaseClient";

// Soft-deletes a conversation from just this user's list. If the other
// person sends something new afterward, it naturally reappears — same
// behavior as WhatsApp's "delete chat".
export async function hideConversation(conversationId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("conversation_participants")
    .update({ hidden_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
}

export async function reportConversation(conversationId: string, reportedUserId: string, reason: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");
  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    reported_user_id: reportedUserId,
    conversation_id: conversationId,
    reason: reason || null,
  });
  if (error) throw error;
}
