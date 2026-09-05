import { supabase } from "./supabaseClient";

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

// Images always come from compressImage as .webp (see uploadChatImage.ts).
// Voice notes always land here with an audio extension, so we can tell them
// apart from a message's media_url alone without a schema migration.
export function isVoiceNotePath(path: string): boolean {
  return /\.(webm|m4a|mp3|ogg|wav|aac)$/i.test(path);
}

export async function uploadChatVoice(blob: Blob, mimeType: string): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");

  const ext = mimeType.includes("mp4") ? "m4a" : "webm";
  const path = `${user.id}/voice-${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from("chat-media").upload(path, blob, {
    contentType: mimeType || "audio/webm",
  });
  if (error) throw error;

  return path;
}
