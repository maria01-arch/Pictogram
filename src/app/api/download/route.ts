import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { R2_PUBLIC_URL } from "@/lib/r2";

export const maxDuration = 60;

// Only files we actually serve — never an arbitrary URL — can be proxied here.
function isAllowedMediaUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;

  if (R2_PUBLIC_URL) {
    try {
      if (u.host === new URL(R2_PUBLIC_URL).host) return true;
    } catch {
      /* R2_PUBLIC_URL misconfigured — fall through */
    }
  }
  // Legacy Supabase Storage public URLs (posts/stories uploaded before the R2 move).
  if (/\.supabase\.co$/.test(u.hostname) && u.pathname.startsWith("/storage/v1/object/public/")) {
    return true;
  }
  return false;
}

// Downloading a photo/video from the app has to go through our own server
// instead of fetching R2/Supabase directly from the browser, for two reasons:
// 1) A JS "fetch → blob → <a download>" depends on the media host sending
//    permissive CORS headers, which R2 doesn't for plain GETs.
// 2) More importantly, inside the Android WebView this app is wrapped in,
//    that blob/anchor trick is handled inconsistently — some file types get
//    silently opened as a page instead of downloaded, and the in-app router
//    doesn't recognize that navigation, so the back button reloads the
//    whole app instead of returning to the feed.
// A same-origin response with Content-Disposition: attachment is what
// Android's WebView.setDownloadListener is actually built to catch, so this
// hands off to the OS's normal download flow for every file type the same way.
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const name = searchParams.get("name") || "download";
  if (!url || !isAllowedMediaUrl(url)) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }

  const upstream = await fetch(url);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "download";
  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") ?? "application/octet-stream");
  headers.set("Content-Disposition", `attachment; filename="${safeName}"`);
  const length = upstream.headers.get("content-length");
  if (length) headers.set("Content-Length", length);
  headers.set("Cache-Control", "private, max-age=0, no-store");

  return new Response(upstream.body, { headers });
}
