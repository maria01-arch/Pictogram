import { NextResponse } from "next/server";
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
// 2) Inside the Android WebView this app is wrapped in, that blob/anchor
//    trick was handled inconsistently per file type — images opened as a
//    page instead of downloading, and the in-app router didn't recognize
//    that navigation, so the back button reloaded the whole app.
// A same-origin response with Content-Disposition: attachment is what
// Android's WebView.setDownloadListener is built to catch, handing off to
// the OS's own DownloadManager.
//
// IMPORTANT: this route has NO login check, on purpose. DownloadManager
// makes its own separate network request — it does not carry the WebView's
// session cookie — so a route that required being signed in always failed
// here with 401, which is exactly the "Download failed" notification this
// fixes. That's not a new privacy hole: post and story media is already
// fully public with no auth at its real R2/Supabase URL (that's how the
// feed's plain <img>/<video> tags render it), so this route only ever
// re-serves bytes anyone could already fetch directly. The allow-list above
// keeps it from being used as a proxy for anything else.
export async function GET(request: Request) {
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
