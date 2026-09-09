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
  const sorting = searchParams.get("sorting") ?? (q ? "relevance" : "toplist");

  const params = new URLSearchParams({
    apikey: apiKey,
    q,
    page,
    sorting,
    order: "desc",
    // Hardcoded, never accepted from the client — SFW only. This is a
    // deliberate product decision, not a default meant to be overridden.
    purity: "100",
    categories: "111",
  });

  try {
    const res = await fetch(`${WALLHAVEN_URL}?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) {
      console.error("Wallhaven error:", res.status, JSON.stringify(data));
      return NextResponse.json({ error: "Gallery request failed" }, { status: 502 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("Wallhaven request threw:", err);
    return NextResponse.json({ error: "Gallery request failed" }, { status: 502 });
  }
}
