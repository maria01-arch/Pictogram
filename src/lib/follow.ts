import { supabase } from "./supabaseClient";
import { createNotification } from "./notifications";
import { getUserLocal } from "@/lib/authUser";
import type { FollowListEntry } from "@/types/database";

export type FollowRelation = "none" | "pending" | "following";

export async function getFollowRelation(targetUserId: string): Promise<FollowRelation> {
  const { data: { user } } = await getUserLocal();
  if (!user || user.id === targetUserId) return "none";

  const { data } = await supabase
    .from("follows")
    .select("status")
    .eq("follower_id", user.id)
    .eq("following_id", targetUserId)
    .maybeSingle();

  if (!data) return "none";
  return data.status === "pending" ? "pending" : "following";
}

export async function toggleFollow(targetUserId: string, currentRelation: FollowRelation) {
  const { data: { user } } = await getUserLocal();
  if (!user) throw new Error("You must be signed in.");

  if (currentRelation === "none") {
    // The database decides whether this becomes "pending" or "accepted"
    // (based on the other person's approval setting) — we only ask to follow.
    const { error } = await supabase.from("follows").insert({
      follower_id: user.id,
      following_id: targetUserId,
    });
    if (error) throw error;

    const { data: row } = await supabase
      .from("follows")
      .select("status")
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId)
      .maybeSingle();
    const willBePending = row?.status !== "accepted";

    createNotification({
      targetUserId,
      type: willBePending ? "follow_request" : "follow_accepted",
    });
  } else {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId);
    if (error) throw error;
  }
}

// Followers are always listable. Following can be hidden by the profile
// owner (Settings → Privacy → "Who can see who you're following").
export async function getFollowers(userId: string): Promise<FollowListEntry[]> {
  const { data, error } = await supabase.rpc("list_followers", { target_user: userId });
  if (error) throw error;
  return (data ?? []) as FollowListEntry[];
}

export async function getFollowingVisibility(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("following_list_visible", { target_user: userId });
  if (error) return true;
  return data !== false;
}

export async function getFollowing(userId: string): Promise<FollowListEntry[]> {
  const { data, error } = await supabase.rpc("list_following", { target_user: userId });
  if (error) throw error;
  return (data ?? []) as FollowListEntry[];
}
