import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { ensureAiBotProfile, AI_BOT_USERNAME } from "@/lib/ensureAiBotProfile";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const id = await ensureAiBotProfile();
    return NextResponse.json({ id, username: AI_BOT_USERNAME });
  } catch (err) {
    console.error("ensureAiBotProfile failed:", err);
    return NextResponse.json({ error: "AI is not available right now" }, { status: 500 });
  }
}
