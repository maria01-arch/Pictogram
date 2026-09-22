import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The client only says "notification <id> was just created". Everything else
// (who to notify, the text, the link) is read from the database row that the
// database itself already validated (see the notifications INSERT policy), so
// nobody can use this route to push arbitrary text to arbitrary people.
// Each notification can trigger at most ONE push (push_sent is claimed atomically).
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let notificationId = "";
  try {
    const body = await request.json();
    notificationId = String(body?.notificationId ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!UUID_RE.test(notificationId)) {
    return NextResponse.json({ error: "Invalid notificationId" }, { status: 400 });
  }

  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !apiKey) {
    return NextResponse.json({ error: "OneSignal not configured" }, { status: 500 });
  }

  // Atomically claim it: only the actor, and only once.
  const { data: notif, error: claimErr } = await supabaseAdmin
    .from("notifications")
    .update({ push_sent: true })
    .eq("id", notificationId)
    .eq("actor_id", user.id)
    .eq("push_sent", false)
    .select("id, user_id, type, post_id, conversation_id")
    .maybeSingle();

  if (claimErr) {
    console.error("push claim failed:", claimErr.message);
    return NextResponse.json({ error: "Could not send" }, { status: 500 });
  }
  if (!notif) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { data: actor } = await supabaseAdmin
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  const name = actor?.username ?? "Someone";

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  let title = "Next Social";
  let text = "You have a new notification";
  let path = "/notifications";

  switch (notif.type) {
    case "like":
      title = "New like";
      text = `${name} liked your post`;
      path = notif.post_id ? `/post/${notif.post_id}` : "/notifications";
      break;
    case "comment":
      title = "New comment";
      text = `${name} commented on your post`;
      path = notif.post_id ? `/post/${notif.post_id}` : "/notifications";
      break;
    case "message":
      title = "New message";
      text = `${name} sent you a message`; // never put message content in a push
      path = notif.conversation_id ? `/chat/${notif.conversation_id}` : "/chat";
      break;
    case "follow_request":
      title = "New follow request";
      text = `${name} wants to follow you`;
      path = "/friends";
      break;
    case "follow_accepted": {
      const { data: f } = await supabaseAdmin
        .from("follows")
        .select("follower_id")
        .eq("follower_id", user.id)
        .eq("following_id", notif.user_id)
        .maybeSingle();
      if (f) {
        title = "New follower";
        text = `${name} started following you`;
      } else {
        title = "Follow request accepted";
        text = `${name} accepted your follow request`;
      }
      path = "/friends";
      break;
    }
    case "account_strike":
      title = "Account notice";
      text = "There is an update on your account health";
      path = "/profile/account-health";
      break;
  }

  const res = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify({
      app_id: appId,
      include_aliases: { external_id: [notif.user_id] },
      target_channel: "push",
      headings: { en: title },
      contents: { en: text },
      url: `${origin}${path}`,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("OneSignal error:", data);
    return NextResponse.json({ error: "Push provider error" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
