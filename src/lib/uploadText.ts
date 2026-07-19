import { supabase } from "./supabaseClient";

export const MIN_TEXT_POST_WORDS = 20;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function uploadTextPost(text: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to post.");

  if (wordCount(text) < MIN_TEXT_POST_WORDS) {
    throw new Error(`Text-only posts need at least ${MIN_TEXT_POST_WORDS} words (currently ${wordCount(text)}).`);
  }

  const { error } = await supabase.from("posts").insert({
    user_id: user.id,
    media_type: "text",
    text_content: text,
    media_url: null,
    thumbnail_url: null,
  });
  if (error) throw error;
}

export async function uploadTextStory(text: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to post a story.");
  if (!text.trim()) throw new Error("Story text can't be empty.");

  const { error } = await supabase.from("stories").insert({
    user_id: user.id,
    media_type: "text",
    text_content: text,
    media_url: null,
    thumbnail_url: null,
  });
  if (error) throw error;
}
