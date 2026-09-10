import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";

const WALLHAVEN_URL = "https://wallhaven.cc/api/v1/search";

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const apiKey = process.env.WALLHAVEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Gallery is not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const page = searchParams.get("page") ?? "1";
  const seed = searchParams.get("seed") ?? "";
  // Default browsing (no search term) uses random sorting with a
  // client-persisted seed — Wallhaven then walks forward through a large
  // shuffled set page after page instead of one fixed, finite ranking, so
  // scrolling genuinely doesn't run out the way a single fixed list would.
  const sorting = searchParams.get("sorting") ?? (q ? "relevance" : "random");

  function buildParams(strict: boolean) {
    const p = new URLSearchParams({
      apikey: apiKey!,
      q,
      page,
      sorting,
      order: "desc",
      // Hardcoded, never accepted from the client — SFW only. This is a
      // deliberate product decision, not a default meant to be overridden.
      purity: "100",
      categories: "111",
    });
    if (sorting === "random" && seed) p.set("seed", seed);
    if (strict) {
      // This is a phone wallpaper gallery — bias toward portrait ratios
      // that actually fill a phone screen instead of wide desktop
      // wallpapers that show up tiny and letterboxed. Deliberately NOT
      // combined with a minimum-resolution filter — stacking both shrank
      // the pool enough that searches ran out of results almost immediately.
      p.set("ratios", "9x16,9x18,9x19,9x20,10x16,1x2");
    }
    return p;
  }

  async function runSearch(strict: boolean) {
    const res = await fetch(`${WALLHAVEN_URL}?${buildParams(strict).toString()}`);
    const data = await res.json();
    if (!res.ok) throw new Error(`Wallhaven ${res.status}: ${JSON.stringify(data)}`);
    return data;
  }

  try {
    let data = await runSearch(true);
    // If the portrait-ratio filter turns up nothing (e.g. a very specific
    // search term with no matching portrait results, or Wallhaven not
    // recognizing one of the ratio values), fall back to an unfiltered
    // search rather than showing the user an empty page.
    if (!data?.data || data.data.length === 0) {
      data = await runSearch(false);
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("Wallhaven request failed:", err);
    return NextResponse.json({ error: "Gallery request failed" }, { status: 502 });
  }
}
