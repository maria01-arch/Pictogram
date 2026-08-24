import { supabase } from "./supabaseClient";

// Checks both directions — either party may have blocked the other.
export async function getBlockStatus(otherUserId: string): Promise<{ blockedByMe: boolean; blockedMe: boolean }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { blockedByMe: false, blockedMe: false };

  const { data: mine } = await supabase
    .from("blocked_users")
    .select("blocked_id")
    .eq("blocker_id", user.id)
    .eq("blocked_id", otherUserId)
    .maybeSingle();

  const { data: theirs } = await supabase
    .from("blocked_users")
    .select("blocker_id")
    .eq("blocker_id", otherUserId)
    .eq("blocked_id", user.id)
    .maybeSingle();

  return { blockedByMe: !!mine, blockedMe: !!theirs };
}

export async function blockUser(otherUserId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");
  const { error } = await supabase.from("blocked_users").insert({ blocker_id: user.id, blocked_id: otherUserId });
  if (error) throw error;
}

export async function unblockUser(otherUserId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");
  const { error } = await supabase.from("blocked_users").delete().eq("blocker_id", user.id).eq("blocked_id", otherUserId);
  if (error) throw error;
}
