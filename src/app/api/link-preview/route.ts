import { NextResponse } from "next/server";
import { promises as dns } from "node:dns";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";

export const maxDuration = 15;

const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const FETCH_TIMEOUT_MS = 6000;
const MAX_BYTES = 300_000; // enough for <head>; stop reading well before a full page
const MAX_REDIRECTS = 3;

interface Preview {
  title: string | null;
  description: string | null;
  image: string | null;
  domain: string;
}

// ---- SSRF protection -----------------------------------------------------
// Unlike /api/download (which only ever proxies our own known-safe media
// hosts), this route fetches whatever URL a person pastes into a message —
// so it has to actively stop being turned into a probe against internal
// services (cloud metadata endpoints, the Supabase/Vercel private network,
// localhost, etc).
function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const lower = ip.toLowerCase();
    return (
      lower === "::1" ||
      lower.startsWith("fe80:") || // link-local
      lower.startsWith("fc") ||
      lower.startsWith("fd") || // unique local
      lower.startsWith("::ffff:127.") ||
      lower.startsWith("::ffff:10.") ||
      lower.startsWith("::ffff:192.168.")
    );
  }
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true; // malformed — reject
  const [a, b] = parts;
  if (a === 127) return true; // loopback
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 0) return true; // 0.0.0.0/8
  return false;
}

async function isSafeHost(hostname: string): Promise<boolean> {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost") || lower === "0.0.0.0") return false;
  try {
    const records = await dns.lookup(hostname, { all: true });
    if (records.length === 0) return false;
    return records.every((r) => !isPrivateIp(r.address));
  } catch {
    return false; // couldn't resolve — refuse rather than guess
  }
}

// Fetches with a manual redirect loop, re-validating the SSRF check on every
// hop (fetch's automatic redirect following would only check the ORIGINAL
// URL, letting a malicious/compromised server redirect us somewhere private
// after the fact).
async function safeFetch(startUrl: string): Promise<Response | null> {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const u = new URL(current);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!(await isSafeHost(u.hostname))) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; NextSocialLinkPreview/1.0)" },
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return null;
      current = new URL(location, current).toString();
      continue;
    }
    return res;
  }
  return null; // too many redirects
}

function extractMeta(html: string, name: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)["']`,
    "i"
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${name}["']`,
    "i"
  );
  const m = html.match(re) ?? html.match(alt);
  if (!m) return null;
  return m[1]
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .trim() || null;
}

async function fetchPreview(url: string): Promise<Preview | null> {
  const res = await safeFetch(url);
  if (!res || !res.ok || !res.body) return null;

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return null;

  // Read only up to MAX_BYTES — the <head> we need is always near the top,
  // and this keeps a huge page from tying up the function or using lots of memory.
  const reader = res.body.getReader();
  let received = 0;
  const chunks: Uint8Array[] = [];
  while (received < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
  }
  reader.cancel().catch(() => {});
  const html = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf-8");

  const finalUrl = res.url || url;
  const domain = new URL(finalUrl).hostname.replace(/^www\./, "");

  const title = extractMeta(html, "og:title") ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? null;
  const description = extractMeta(html, "og:description") ?? extractMeta(html, "description");
  let image = extractMeta(html, "og:image");
  if (image) {
    try {
      image = new URL(image, finalUrl).toString();
    } catch {
      image = null;
    }
  }

  if (!title && !image) return null;
  return { title, description, image, domain };
}

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");
  if (!rawUrl) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }
  let url: string;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("bad protocol");
    url = parsed.toString();
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  const { data: cached } = await supabaseAdmin
    .from("link_preview_cache")
    .select("title, description, image, domain, fetched_at")
    .eq("url", url)
    .maybeSingle();
  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_MAX_AGE_MS) {
    const { fetched_at, ...preview } = cached;
    return NextResponse.json(preview);
  }

  if (!(await rateLimit(user.id, "link_preview", 60, 3600))) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  let preview: Preview | null;
  try {
    preview = await fetchPreview(url);
  } catch (err) {
    console.error("link preview fetch failed:", err);
    preview = null;
  }

  if (!preview) {
    // Cache the miss too (briefly, via a short-lived row) so a broken/blocked
    // link in a busy group thread doesn't get re-fetched by every viewer.
    const domain = (() => {
      try {
        return new URL(url).hostname.replace(/^www\./, "");
      } catch {
        return "";
      }
    })();
    return NextResponse.json({ title: null, description: null, image: null, domain });
  }

  await supabaseAdmin.from("link_preview_cache").upsert({
    url,
    title: preview.title,
    description: preview.description,
    image: preview.image,
    domain: preview.domain,
    fetched_at: new Date().toISOString(),
  });

  return NextResponse.json(preview);
}
