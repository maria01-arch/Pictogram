import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { drainMediaQueue } from "@/lib/mediaQueue";

// Called (fire-and-forget) by the app right after a post is deleted so the
// files disappear immediately. Safe for any signed-in user: it can only remove
// files that database triggers already queued for deleted rows.
export async function POST() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const result = await drainMediaQueue(50);
  return NextResponse.json({ ok: true, ...result });
}
