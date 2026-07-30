import { supabase } from "./supabaseClient";
import type { NotificationType } from "@/types/database";

interface CreateNotificationArgs {
  targetUserId: string;
  type: NotificationType;
  postId?: string;
  commentId?: string;
  conversationId?: string;
  pushTitle: string;
  pushBody: string;
  pushUrl?: string;
}

export async function createNotification({
  targetUserId,
  type,
  postId,
  commentId,
  conversationId,
  pushTitle,
  pushBody,
  pushUrl,
}: CreateNotificationArgs) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id === targetUserId) return; // never notify yourself

  await supabase.from("notifications").insert({
    user_id: targetUserId,
    actor_id: user.id,
    type,
    post_id: postId ?? null,
    comment_id: commentId ?? null,
    conversation_id: conversationId ?? null,
  });

  // Fire-and-forget push — don't block the UI action on delivery.
  fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetUserId, title: pushTitle, body: pushBody, url: pushUrl }),
  }).catch(() => {});
}
