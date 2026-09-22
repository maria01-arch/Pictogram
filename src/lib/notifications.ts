import { supabase } from "./supabaseClient";
import type { NotificationType } from "@/types/database";
import { getUserLocal } from "@/lib/authUser";

interface CreateNotificationArgs {
  targetUserId: string;
  type: NotificationType;
  postId?: string;
  commentId?: string;
  conversationId?: string;
  // Kept so older call sites still compile. The server now writes the push
  // text itself from the notification row, so these are ignored.
  pushTitle?: string;
  pushBody?: string;
  pushUrl?: string;
}

export async function createNotification({
  targetUserId,
  type,
  postId,
  commentId,
  conversationId,
}: CreateNotificationArgs) {
  const { data: { user } } = await getUserLocal();
  if (!user || user.id === targetUserId) return; // never notify yourself

  // We generate the id ourselves: the sender is not allowed to READ the
  // notification row afterwards (it belongs to the recipient), so we can't
  // ask the database to hand the id back.
  const id = crypto.randomUUID();
  const { error } = await supabase.from("notifications").insert({
    id,
    user_id: targetUserId,
    actor_id: user.id,
    type,
    post_id: postId ?? null,
    comment_id: commentId ?? null,
    conversation_id: conversationId ?? null,
  });
  if (error) return; // the database refused (not a real event) — no push either

  // Fire-and-forget push — the server looks up the row by id, builds the text
  // itself, and sends at most one push per notification.
  fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notificationId: id }),
  }).catch(() => {});
}
