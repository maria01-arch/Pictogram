import { supabase } from "./supabaseClient";
import { getUserLocal } from "@/lib/authUser";

// Checks both directions — either party may have blocked the other.
export async function getBlockStatus(otherUserId: string): Promise<{ blockedByMe: boolean; blockedMe: boolean }> {
  const { data: { user } } = await getUserLocal();
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
  const { data: { user } } = await getUserLocal();
  if (!user) throw new Error("You must be signed in.");
  const { error } = await supabase.from("blocked_users").insert({ blocker_id: user.id, blocked_id: otherUserId });
  if (error) throw error;
  // Blocking also ends any follow relationship in both directions.
  await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", otherUserId);
  await supabase.from("follows").delete().eq("follower_id", otherUserId).eq("following_id", user.id);
  clearBlockedCache();
}

export async function unblockUser(otherUserId: string) {
  const { data: { user } } = await getUserLocal();
  if (!user) throw new Error("You must be signed in.");
  const { error } = await supabase.from("blocked_users").delete().eq("blocker_id", user.id).eq("blocked_id", otherUserId);
  if (error) throw error;
  clearBlockedCache();
}

// Everyone I blocked plus everyone who blocked me (both directions hide content).
// Cached for a minute — feeds, comments and search call this a lot.
let blockedCache: { at: number; ids: Set<string> } | null = null;

export function clearBlockedCache() {
  blockedCache = null;
}

export async function getBlockedUserIds(): Promise<Set<string>> {
  if (blockedCache && Date.now() - blockedCache.at < 60_000) return blockedCache.ids;
  const { data: { user } } = await getUserLocal();
  if (!user) return new Set();
  const { data } = await supabase.from("blocked_users").select("blocker_id, blocked_id");
  const ids = new Set<string>();
  for (const row of data ?? []) {
    ids.add(row.blocker_id === user.id ? row.blocked_id : row.blocker_id);
  }
  blockedCache = { at: Date.now(), ids };
  return ids;
}
