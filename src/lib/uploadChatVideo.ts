import { supabase } from "./supabaseClient";
import { compressVideo, extractThumbnail } from "./compressVideo";
import { getUserLocal } from "@/lib/authUser";

// Every chat video path gets this prefix so it can be told apart from a
// voice note (both currently produce .webm — see uploadChatVoice.ts).
function basename(path: string): string {
  const withoutQuery = path.split("?")[0];
  return withoutQuery.slice(withoutQuery.lastIndexOf("/") + 1);
}

export function isChatVideoPath(path: string): boolean {
  return /^video-/i.test(basename(path));
}

export interface ChatVideoUploadResult {
  path: string;
  thumbnailPath: string;
}

// chat-media is a PRIVATE bucket — same as uploadChatImage.ts. `maxDurationSeconds`
// comes from lib/videoLimits.ts (25s unverified / 60s verified in DMs).
export async function uploadChatVideo(file: File, maxDurationSeconds: number): Promise<ChatVideoUploadResult> {
  const { data: { user } } = await getUserLocal();
  if (!user) throw new Error("You must be signed in.");

  const { file: compressed } = await compressVideo(file, undefined, maxDurationSeconds);
  const thumbnailBlob = await extractThumbnail(file);

  const id = crypto.randomUUID();
  const path = `${user.id}/video-${id}.webm`;
  const thumbnailPath = `${user.id}/video-${id}-thumb.jpg`;

  const [videoRes, thumbRes] = await Promise.all([
    supabase.storage.from("chat-media").upload(path, compressed, { contentType: "video/webm" }),
    supabase.storage.from("chat-media").upload(thumbnailPath, thumbnailBlob, { contentType: "image/jpeg" }),
  ]);
  if (videoRes.error) throw videoRes.error;
  if (thumbRes.error) throw thumbRes.error;

  return { path, thumbnailPath };
}
