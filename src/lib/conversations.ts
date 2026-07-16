import { supabase } from "./supabaseClient";

// Finds an existing 1:1 conversation with otherUserId, or creates one.
export async function getOrCreateDirectConversation(otherUserId: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");

  const { data: mine } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", user.id);

  const myConvoIds = (mine ?? []).map((r) => r.conversation_id);

  if (myConvoIds.length > 0) {
    const { data: shared } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", otherUserId)
      .in("conversation_id", myConvoIds);

    if (shared && shared.length > 0) return shared[0].conversation_id;
  }

  const { data: convo, error: convoError } = await supabase
    .from("conversations")
    .insert({ is_group: false })
    .select("id")
    .single();
  if (convoError || !convo) throw convoError ?? new Error("Failed to create conversation");

  const { error: participantsError } = await supabase.from("conversation_participants").insert([
    { conversation_id: convo.id, user_id: user.id },
    { conversation_id: convo.id, user_id: otherUserId },
  ]);
  if (participantsError) throw participantsError;

  return convo.id;
}
