import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { deleteR2Prefix, deleteStorageFolder, drainMediaQueue } from "@/lib/mediaQueue";

export const maxDuration = 60;

// Permanently deletes the signed-in user's account and everything they own.
// Required by Google Play (in-app account deletion).
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let confirm = "";
  try {
    const body = await request.json();
    confirm = String(body?.confirm ?? "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  if (profile.username === "ai_assistant") {
    return NextResponse.json({ error: "This account cannot be deleted" }, { status: 403 });
  }
  if (confirm !== String(profile.username).toLowerCase()) {
    return NextResponse.json({ error: "Type your username exactly to confirm" }, { status: 400 });
  }

  // 1) Delete the login. Every table that references the profile cascades, and
  //    database triggers queue the removed posts/stories/chat files for cleanup.
  const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (delErr) {
    console.error("deleteUser failed:", delErr.message);
    return NextResponse.json({ error: "Could not delete the account. Please try again." }, { status: 500 });
  }

  // 2) Files. Best effort — the account is already gone, so never fail here.
  try {
    await drainMediaQueue(500);
  } catch (e) {
    console.error("drain after account delete failed:", e);
  }
  try {
    await deleteR2Prefix(`posts/${user.id}/`);
    await deleteR2Prefix(`stories/${user.id}/`);
  } catch (e) {
    console.error("R2 prefix cleanup failed:", e);
  }
  for (const bucket of ["avatars", "chat-media", "verification-docs"]) {
    try {
      await deleteStorageFolder(bucket, user.id);
    } catch (e) {
      console.error(`storage cleanup failed (${bucket}):`, e);
    }
  }

  return NextResponse.json({ ok: true });
}
