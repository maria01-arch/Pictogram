import { supabase } from "./supabaseClient";
import { compressImage } from "./compressImage";

// chat-media is a PRIVATE bucket (see fix_chat_media_private.sql) — we store
// the bare storage path in messages.media_url and resolve it to a short-lived
// signed URL at render time (see resolveChatMediaUrl below), instead of a
// public URL that anyone with the link could open.
export async function uploadChatImage(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");

  const { file: compressed } = await compressImage(file, { maxWidth: 1080 });
  const path = `${user.id}/${crypto.randomUUID()}-${compressed.name}`;

  const { error } = await supabase.storage.from("chat-media").upload(path, compressed, {
    contentType: "image/webp",
  });
  if (error) throw error;

  return path;
}

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

// Resolves a chat-media storage path to a signed URL, valid for 1 hour.
// Cached in-memory so re-rendering the same message doesn't re-request it.
export async function resolveChatMediaUrl(path: string): Promise<string | null> {
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const { data, error } = await supabase.storage.from("chat-media").createSignedUrl(path, 3600);
  if (error || !data) return null;

  signedUrlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + 55 * 60 * 1000 });
  return data.signedUrl;
}
