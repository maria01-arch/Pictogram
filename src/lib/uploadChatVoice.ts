import { supabase } from "./supabaseClient";
import { getUserLocal } from "@/lib/authUser";

// Preference order — Opus-in-WebM is what most Android browsers/WebViews
// support; MP4/AAC covers Safari/iOS if this ever runs there.
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

export function pickVoiceMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

// Images always come from compressImage as .webp (see uploadChatImage.ts);
// chat videos always come from compressVideo as .webm with a "video-" prefix
// (see uploadChatVideo.ts) — which, since compressVideo also outputs .webm,
// means a voice note can no longer be told apart from a video by extension
// alone. Voice notes are the only chat upload with a "voice-" filename
// prefix, so that's the actual signal now.
function basename(path: string): string {
  const withoutQuery = path.split("?")[0];
  return withoutQuery.slice(withoutQuery.lastIndexOf("/") + 1);
}

export function isVoiceNotePath(path: string): boolean {
  return /^voice-/i.test(basename(path));
}

export async function uploadChatVoice(blob: Blob, mimeType: string): Promise<string> {
  const {
    data: { user },
  } = await getUserLocal();
  if (!user) throw new Error("You must be signed in.");

  const ext = mimeType.includes("mp4") ? "m4a" : "webm";
  const path = `${user.id}/voice-${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from("chat-media").upload(path, blob, {
    contentType: mimeType || "audio/webm",
  });
  if (error) throw error;

  return path;
}
