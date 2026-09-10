import { supabase } from "./supabaseClient";

export interface WallpaperItem {
  id: string;
  path: string; // full-resolution image URL
  thumbs: { small: string; large: string; original: string };
  resolution: string;
  file_size: number;
}

export interface GalleryPage {
  data: WallpaperItem[];
  meta: { current_page: number; last_page: number };
}

export async function searchWallpapers(q: string, page: number, seed?: string): Promise<GalleryPage> {
  const params = new URLSearchParams({ q, page: String(page) });
  if (seed) params.set("seed", seed);
  const res = await fetch(`/api/gallery/search?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Gallery request failed");
  return data;
}

export interface FavoriteRow {
  id: string;
  wallhaven_id: string;
  thumb_url: string;
  full_url: string;
  resolution: string | null;
  created_at: string;
}

export async function getFavorites(): Promise<FavoriteRow[]> {
  const { data, error } = await supabase.from("gallery_favorites").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addFavorite(w: WallpaperItem) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");
  const { error } = await supabase.from("gallery_favorites").insert({
    user_id: user.id,
    wallhaven_id: w.id,
    thumb_url: w.thumbs.large,
    full_url: w.path,
    resolution: w.resolution,
  });
  if (error) throw error;
}

export async function removeFavorite(wallhavenId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from("gallery_favorites").delete().eq("user_id", user.id).eq("wallhaven_id", wallhavenId);
  if (error) throw error;
}

// Sends a wallpaper's full-resolution URL directly as a chat message's
// media_url — no upload needed, it's already hosted (see the
// resolveChatMediaUrl passthrough for http(s) URLs).
export async function sendWallpaperToChat(conversationId: string, imageUrl: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    content: null,
    media_url: imageUrl,
  });
  if (error) throw error;
}
