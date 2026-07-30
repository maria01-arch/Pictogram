import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { targetUserId, title, body, url } = await request.json();

  if (!targetUserId || !title) {
    return NextResponse.json({ error: "Missing targetUserId or title" }, { status: 400 });
  }

  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !apiKey) {
    return NextResponse.json({ error: "OneSignal not configured" }, { status: 500 });
  }

  const res = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify({
      app_id: appId,
      // Current OneSignal API: external-id targeting now goes through
      // include_aliases + an explicit target_channel, not the old
      // include_external_user_ids field (which is silently accepted but
      // resolves zero recipients under the newer subscription model).
      include_aliases: { external_id: [targetUserId] },
      target_channel: "push",
      headings: { en: title },
      contents: { en: body },
      ...(url ? { url } : {}),
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("OneSignal error:", data);
    return NextResponse.json({ error: data }, { status: 502 });
  }

  return NextResponse.json({ ok: true, data });
}
