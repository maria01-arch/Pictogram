import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/r2";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { rateLimit } from "@/lib/rateLimit";

const ALLOWED_FOLDERS = ["posts", "stories"] as const;

// What the app actually uploads (see compressImage / compressVideo).
const MAX_BYTES: Record<string, number> = {
  "image/webp": 8 * 1024 * 1024,
  "image/jpeg": 8 * 1024 * 1024,
  "image/png": 8 * 1024 * 1024,
  "video/webm": 60 * 1024 * 1024,
  "video/mp4": 60 * 1024 * 1024,
};

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { filename, contentType, folder, size } = payload ?? {};

  if (
    typeof filename !== "string" ||
    typeof contentType !== "string" ||
    !ALLOWED_FOLDERS.includes(folder) ||
    typeof size !== "number" ||
    !Number.isFinite(size) ||
    size <= 0
  ) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const maxBytes = MAX_BYTES[contentType];
  if (!maxBytes) {
    return NextResponse.json({ error: "This file type is not allowed" }, { status: 400 });
  }
  if (size > maxBytes) {
    return NextResponse.json(
      { error: `File is too large (max ${Math.round(maxBytes / 1024 / 1024)} MB)` },
      { status: 413 }
    );
  }

  // 300 uploads per hour per person is far more than normal use.
  if (!(await rateLimit(user.id, "upload", 300, 3600))) {
    return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
  }

  // Key includes the authenticated user's own id (never anything the client
  // supplied). The database also refuses post/story rows whose media URL is
  // not inside the poster's own folder.
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const key = `${folder}/${user.id}/${crypto.randomUUID()}-${safeName}`;

  // ContentLength is part of the signature, so R2 rejects an upload whose real
  // size differs from what we approved above.
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: size,
  });
  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 });
  const publicUrl = `${R2_PUBLIC_URL}/${key}`;

  return NextResponse.json({ uploadUrl, publicUrl });
}
