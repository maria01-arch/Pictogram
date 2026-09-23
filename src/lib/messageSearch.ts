import { supabase } from "./supabaseClient";
import { isVoiceNotePath } from "./uploadChatVoice";

export type MessageMediaFilter = "all" | "text" | "photo" | "voice";

export interface MessageSearchResult {
  id: string;
  content: string | null;
  media_url: string | null;
  created_at: string;
  sender_id: string;
}

export interface MessageSearchOptions {
  keyword?: string;
  mediaType?: MessageMediaFilter;
  /** yyyy-mm-dd, from a native <input type="date"> */
  dateFrom?: string;
  dateTo?: string;
}

export async function searchMessages(
  conversationId: string,
  opts: MessageSearchOptions
): Promise<MessageSearchResult[]> {
  let query = supabase
    .from("messages")
    .select("id, content, media_url, created_at, sender_id")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(100);

  const keyword = opts.keyword?.trim();
  if (keyword) {
    // A single-column filter, so — unlike an .or() filter string built from
    // several columns — special characters in the search term can't break
    // the query the way they could in SearchView's combined search.
    query = query.ilike("content", `%${keyword}%`);
  }
  if (opts.mediaType === "text") {
    query = query.is("media_url", null);
  } else if (opts.mediaType === "photo" || opts.mediaType === "voice") {
    query = query.not("media_url", "is", null);
  }
  if (opts.dateFrom) query = query.gte("created_at", `${opts.dateFrom}T00:00:00.000Z`);
  if (opts.dateTo) query = query.lte("created_at", `${opts.dateTo}T23:59:59.999Z`);

  const { data, error } = await query;
  if (error) throw error;
  let rows = (data ?? []) as MessageSearchResult[];

  // Photo vs. voice both just mean "has media_url" at the database level —
  // the actual distinction only exists client-side (see isVoiceNotePath).
  if (opts.mediaType === "photo") rows = rows.filter((m) => m.media_url && !isVoiceNotePath(m.media_url));
  if (opts.mediaType === "voice") rows = rows.filter((m) => m.media_url && isVoiceNotePath(m.media_url));

  return rows;
}
