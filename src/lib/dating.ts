import { supabase } from "./supabaseClient";
import type { DatingProfile, Profile } from "@/types/database";

export async function getMyDatingProfile(): Promise<DatingProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("dating_profiles").select("*").eq("user_id", user.id).maybeSingle();
  return data;
}

export async function enableDating(bio: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");
  const { error } = await supabase
    .from("dating_profiles")
    .upsert({ user_id: user.id, enabled: true, bio, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function disableDating() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");
  const { error } = await supabase.from("dating_profiles").update({ enabled: false }).eq("user_id", user.id);
  if (error) throw error;
}

export interface DatingCandidate {
  profile: Profile;
  bio: string | null;
}

export async function fetchCandidates(onlineUserIds: string[]): Promise<DatingCandidate[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const ids = onlineUserIds.filter((id) => id !== user.id);
  if (ids.length === 0) return [];

  const { data: datingRows } = await supabase
    .from("dating_profiles")
    .select("user_id, bio, profiles!dating_profiles_user_id_fkey(*)")
    .in("user_id", ids)
    .eq("enabled", true);

  return (datingRows ?? [])
    .filter((row: any) => row.profiles)
    .map((row: any) => ({ profile: row.profiles as Profile, bio: row.bio }));
}

export async function likeUser(likedId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");

  const { error } = await supabase.from("dating_likes").insert({ liker_id: user.id, liked_id: likedId });
  if (error) throw error;

  const a = user.id < likedId ? user.id : likedId;
  const b = user.id < likedId ? likedId : user.id;
  const { data: match } = await supabase
    .from("dating_matches")
    .select("*")
    .eq("user_a", a)
    .eq("user_b", b)
    .maybeSingle();

  return !!match;
}

export interface DatingMatchSummary {
  profile: Profile;
  matchedAt: string;
}

export async function fetchMatches(): Promise<DatingMatchSummary[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("dating_matches")
    .select("user_a, user_b, created_at, profile_a:profiles!dating_matches_user_a_fkey(*), profile_b:profiles!dating_matches_user_b_fkey(*)")
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row: any) => ({
    profile: row.user_a === user.id ? row.profile_b : row.profile_a,
    matchedAt: row.created_at,
  }));
}
