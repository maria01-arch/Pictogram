// Migrates existing posts/stories media (images + videos + thumbnails) from
// Supabase Storage to Cloudflare R2, and updates the database rows to point
// at the new R2 URLs.
//
// Run locally, once:
//   export NEXT_PUBLIC_SUPABASE_URL=...
//   export SUPABASE_SERVICE_ROLE_KEY=...
//   export R2_ACCOUNT_ID=...
//   export R2_ACCESS_KEY_ID=...
//   export R2_SECRET_ACCESS_KEY=...
//   export R2_BUCKET_NAME=...
//   export R2_PUBLIC_URL=...            (no trailing slash)
//   node scripts/migrate-to-r2.mjs
//
// Safe to re-run: any row whose URL already points at R2_PUBLIC_URL is
// skipped, so an interrupted run can just be started again.

import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "node:crypto";

const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const R2_ACCOUNT_ID = requireEnv("R2_ACCOUNT_ID");
const R2_ACCESS_KEY_ID = requireEnv("R2_ACCESS_KEY_ID");
const R2_SECRET_ACCESS_KEY = requireEnv("R2_SECRET_ACCESS_KEY");
const R2_BUCKET_NAME = requireEnv("R2_BUCKET_NAME");
const R2_PUBLIC_URL = requireEnv("R2_PUBLIC_URL").replace(/\/$/, "");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const STORAGE_URL_RE = /\/storage\/v1\/object\/public\/(posts|stories)\/(.+)$/;

function alreadyMigrated(url) {
  return !url || url.startsWith(R2_PUBLIC_URL);
}

async function migrateOne(url, userId) {
  const match = url.match(STORAGE_URL_RE);
  if (!match) {
    console.warn(`  ! URL doesn't look like Supabase Storage, leaving as-is: ${url}`);
    return url;
  }
  const [, bucket, path] = match;

  const { data: blob, error: downloadError } = await supabase.storage.from(bucket).download(path);
  if (downloadError) {
    console.error(`  ! Download failed for ${bucket}/${path}:`, downloadError.message);
    return url; // leave the row untouched rather than losing the reference
  }

  const bytes = Buffer.from(await blob.arrayBuffer());
  const basename = path.split("/").pop();
  const key = `${bucket}/${userId}/${crypto.randomUUID()}-${basename}`;

  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: bytes,
      ContentType: blob.type || "application/octet-stream",
    })
  );

  return `${R2_PUBLIC_URL}/${key}`;
}

async function migratePostsAndStories(table) {
  console.log(`\n=== ${table} ===`);
  let from = 0;
  const pageSize = 100;
  let migrated = 0;

  while (true) {
    const { data: rows, error } = await supabase
      .from(table)
      .select("id, user_id, media_url, thumbnail_url")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!rows || rows.length === 0) break;

    for (const row of rows) {
      const updates = {};
      if (!alreadyMigrated(row.media_url)) {
        updates.media_url = await migrateOne(row.media_url, row.user_id);
      }
      if (!alreadyMigrated(row.thumbnail_url)) {
        updates.thumbnail_url = await migrateOne(row.thumbnail_url, row.user_id);
      }
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase.from(table).update(updates).eq("id", row.id);
        if (updateError) console.error(`  ! Failed to update ${table} ${row.id}:`, updateError.message);
        else migrated++;
        console.log(`  ${table} ${row.id}: migrated`);
      }
    }

    from += pageSize;
  }
  console.log(`${table}: ${migrated} row(s) migrated.`);
}

async function migratePostMedia() {
  console.log(`\n=== post_media (carousel slides) ===`);
  let from = 0;
  const pageSize = 100;
  let migrated = 0;

  while (true) {
    const { data: rows, error } = await supabase
      .from("post_media")
      .select("id, media_url, posts!post_media_post_id_fkey(user_id)")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!rows || rows.length === 0) break;

    for (const row of rows) {
      if (alreadyMigrated(row.media_url)) continue;
      const userId = row.posts?.user_id;
      if (!userId) continue;
      const newUrl = await migrateOne(row.media_url, userId);
      const { error: updateError } = await supabase.from("post_media").update({ media_url: newUrl }).eq("id", row.id);
      if (updateError) console.error(`  ! Failed to update post_media ${row.id}:`, updateError.message);
      else migrated++;
      console.log(`  post_media ${row.id}: migrated`);
    }

    from += pageSize;
  }
  console.log(`post_media: ${migrated} row(s) migrated.`);
}

async function main() {
  await migratePostsAndStories("posts");
  await migratePostsAndStories("stories");
  await migratePostMedia();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
