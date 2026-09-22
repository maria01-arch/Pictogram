import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Admin-only: suspend (ban from signing in) or restore a user.
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Checked with the caller's own session, so RLS decides who counts as admin.
  const { data: adminRow } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!adminRow) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let userId = "";
  let suspend = true;
  try {
    const body = await request.json();
    userId = String(body?.userId ?? "");
    suspend = body?.suspend !== false;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }
  if (userId === user.id) {
    return NextResponse.json({ error: "You cannot suspend yourself" }, { status: 400 });
  }

  const { data: targetAdmin } = await supabaseAdmin
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (targetAdmin) {
    return NextResponse.json({ error: "You cannot suspend another admin" }, { status: 400 });
  }

  const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: suspend ? "876000h" : "none",
  });
  if (banErr) {
    console.error("suspend failed:", banErr.message);
    return NextResponse.json({ error: "Could not update the account" }, { status: 500 });
  }

  await supabaseAdmin
    .from("profiles")
    .update({ suspended_at: suspend ? new Date().toISOString() : null })
    .eq("id", userId);

  return NextResponse.json({ ok: true });
}
