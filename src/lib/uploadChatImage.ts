import { supabase } from "./supabaseClient";
import { compressImage } from "./compressImage";

export async function uploadChatImage(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");

  const { file: compressed } = await compressImage(file, { maxWidth: 1080 });
  const path = `${user.id}/${crypto.randomUUID()}-${compressed.name}`;

  const { error } = await supabase.storage.from("chat-media").upload(path, compressed, {
    contentType: "image/webp",
  });
  if (error) throw error;

  return supabase.storage.from("chat-media").getPublicUrl(path).data.publicUrl;
}
