import { supabase } from "./supabaseClient";
import { createNotification } from "./notifications";

export type FollowRelation = "none" | "pending" | "following";

export async function getFollowRelation(targetUserId: string): Promise<FollowRelation> {
  const { data: { user } } = await supabase.auth.getUser();
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");

  if (currentRelation === "none") {
    const { data: target } = await supabase
      .from("profiles")
      .select("requires_follow_approval")
      .eq("id", targetUserId)
      .single();

    const willBePending = !!target?.requires_follow_approval;

    const { error } = await supabase.from("follows").insert({
      follower_id: user.id,
      following_id: targetUserId,
      status: willBePending ? "pending" : "accepted",
    });
    if (error) throw error;

    const { data: me } = await supabase.from("profiles").select("username").eq("id", user.id).single();
    createNotification({
      targetUserId,
      type: willBePending ? "follow_request" : "follow_accepted",
      pushTitle: willBePending ? "New follow request" : "New follower",
      pushBody: willBePending
        ? `${me?.username ?? "Someone"} wants to follow you`
        : `${me?.username ?? "Someone"} started following you`,
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
