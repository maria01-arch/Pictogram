import { supabase } from "./supabaseClient";
import { getUserLocal } from "@/lib/authUser";

// Soft-deletes a conversation from just this user's list. If the other
// person sends something new afterward, it naturally reappears — same
// behavior as WhatsApp's "delete chat".
export async function hideConversation(conversationId: string) {
  const { data: { user } } = await getUserLocal();
  if (!user) return;
  await supabase
    .from("conversation_participants")
    .update({ hidden_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
}

export async function reportConversation(conversationId: string, reportedUserId: string, reason: string) {
  const { data: { user } } = await getUserLocal();
  if (!user) throw new Error("You must be signed in.");

  // Snapshot the last few messages so an admin can act even though admins
  // cannot read private chats. The reporter is a participant, so they are
  // allowed to read (and choose to share) this.
  let evidence: string | null = null;
  const { data: recent } = await supabase
    .from("messages")
    .select("sender_id, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (recent && recent.length > 0) {
    evidence = recent
      .reverse()
      .map((m) => `${m.sender_id === user.id ? "Reporter" : "Reported"}: ${m.content ?? "[attachment]"}`)
      .join("\n")
      .slice(0, 2000);
  }

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    reported_user_id: reportedUserId,
    conversation_id: conversationId,
    target_type: "conversation",
    reason: reason || null,
    evidence,
  });
  if (error) throw error;
}
