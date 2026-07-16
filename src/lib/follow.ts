import { supabase } from "./supabaseClient";

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

    const { error } = await supabase.from("follows").insert({
      follower_id: user.id,
      following_id: targetUserId,
      status: target?.requires_follow_approval ? "pending" : "accepted",
    });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId);
    if (error) throw error;
  }
}
