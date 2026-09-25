import { supabase } from "./supabaseClient";
import { isVoiceNotePath } from "./uploadChatVoice";
import { isChatVideoPath } from "./uploadChatVideo";

export type MessageMediaFilter = "all" | "text" | "photo" | "video" | "voice";

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

// `%` and `_` are wildcards inside a LIKE/ILIKE pattern — `_` in particular
// means "any single character", so an unescaped search for e.g. "my_post"
// would also match "myXpost", "my.post", etc. That's what made results feel
// "inaccurate": a keyword with an underscore (common in usernames/handles)
// matched far more than the literal text typed. Escaping the user's text
// before wrapping it in our own %...% wildcards fixes that.
function escapeLikePattern(raw: string): string {
  return raw.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function searchMessages(
  conversationId: string,
  opts: MessageSearchOptions
): Promise<MessageSearchResult[]> {
  let query = supabase
    .from("messages")
    .select("id, content, media_url, created_at, sender_id")
    .eq("conversation_id", conversationId)
    // Ascending, so search results and the up/down "find next" navigation
    // move through the conversation in reading order.
    .order("created_at", { ascending: true })
    .limit(200);

  const keyword = opts.keyword?.trim();
  if (keyword) {
    query = query.ilike("content", `%${escapeLikePattern(keyword)}%`);
  }
  if (opts.mediaType === "text") {
    query = query.is("media_url", null);
  } else if (opts.mediaType === "photo" || opts.mediaType === "video" || opts.mediaType === "voice") {
    query = query.not("media_url", "is", null);
  }
  if (opts.dateFrom) query = query.gte("created_at", `${opts.dateFrom}T00:00:00.000Z`);
  if (opts.dateTo) query = query.lte("created_at", `${opts.dateTo}T23:59:59.999Z`);

  const { data, error } = await query;
  if (error) throw error;
  let rows = (data ?? []) as MessageSearchResult[];

  // Photo/video/voice all just mean "has media_url" at the database level —
  // the actual distinction only exists client-side (see isVoiceNotePath /
  // isChatVideoPath).
  if (opts.mediaType === "photo") {
    rows = rows.filter((m) => m.media_url && !isVoiceNotePath(m.media_url) && !isChatVideoPath(m.media_url));
  }
  if (opts.mediaType === "video") rows = rows.filter((m) => m.media_url && isChatVideoPath(m.media_url));
  if (opts.mediaType === "voice") rows = rows.filter((m) => m.media_url && isVoiceNotePath(m.media_url));

  return rows;
}
