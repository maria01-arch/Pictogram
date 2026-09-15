import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/r2";
import { createServerSupabaseClient } from "@/lib/supabaseServer";

const ALLOWED_FOLDERS = ["posts", "stories"] as const;

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { filename, contentType, folder } = await request.json();
  if (
    typeof filename !== "string" ||
    typeof contentType !== "string" ||
    !ALLOWED_FOLDERS.includes(folder)
  ) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Key includes the authenticated user's own id (not anything the client
  // supplied) — same ownership guarantee the old Supabase Storage path-based
  // policies gave us, just enforced server-side here instead of via RLS.
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const key = `${folder}/${user.id}/${crypto.randomUUID()}-${safeName}`;

  const command = new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType });
  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 });
  const publicUrl = `${R2_PUBLIC_URL}/${key}`;

  return NextResponse.json({ uploadUrl, publicUrl });
}
