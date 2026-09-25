import { supabase } from "./supabaseClient";
import { getUserLocal } from "@/lib/authUser";

export type VideoContext = "feed" | "dm";

// Verified accounts get a full minute everywhere; unverified accounts get a
// shorter clip, and the DM cap is a little more generous than the feed cap.
export const VIDEO_DURATION_LIMITS: Record<VideoContext, { verified: number; unverified: number }> = {
  feed: { verified: 60, unverified: 20 },
  dm: { verified: 60, unverified: 25 },
};

let verifiedCache: { at: number; value: boolean } | null = null;

// Cached for a minute — this gets called right as someone picks a video,
// which shouldn't cost an extra round trip every single time.
async function amIVerified(): Promise<boolean> {
  if (verifiedCache && Date.now() - verifiedCache.at < 60_000) return verifiedCache.value;
  const { data: { user } } = await getUserLocal();
  if (!user) return false;
  const { data } = await supabase.from("profiles").select("is_verified").eq("id", user.id).maybeSingle();
  const value = !!data?.is_verified;
  verifiedCache = { at: Date.now(), value };
  return value;
}

export async function getMyVideoLimitSeconds(context: VideoContext): Promise<number> {
  const verified = await amIVerified();
  return verified ? VIDEO_DURATION_LIMITS[context].verified : VIDEO_DURATION_LIMITS[context].unverified;
}
