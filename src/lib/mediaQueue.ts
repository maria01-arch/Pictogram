import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { r2, R2_BUCKET, R2_PUBLIC_URL } from "./r2";
import { supabaseAdmin } from "./supabaseAdmin";

// Server-only. Empties media_delete_queue (filled by database triggers whenever
// a post / story / carousel slide / chat message is deleted) and removes the
// real files from Cloudflare R2 and Supabase Storage.

// keys we created: posts/<user-uuid>/... or stories/<user-uuid>/...
const R2_KEY_RE = /^(posts|stories)\/[0-9a-f-]{36}\/[^/]+$/i;
// legacy files that still live in Supabase Storage (from before the R2 move)
const LEGACY_STORAGE_RE = /\/storage\/v1\/object\/public\/(posts|stories)\/(.+)$/;

interface QueueRow {
  id: number;
  kind: "url" | "supabase";
  bucket: string | null;
  path: string;
  attempts: number;
}

export async function drainMediaQueue(limit = 100): Promise<{ processed: number; failed: number }> {
  const { data, error } = await supabaseAdmin
    .from("media_delete_queue")
    .select("id, kind, bucket, path, attempts")
    .order("queued_at", { ascending: true })
    .limit(limit);
  if (error || !data || data.length === 0) return { processed: 0, failed: 0 };

  const rows = data as QueueRow[];
  const r2Rows: { row: QueueRow; key: string }[] = [];
  const sbRows: { row: QueueRow; bucket: string; path: string }[] = [];
  const ignore: number[] = [];
  const r2Base = R2_PUBLIC_URL ? R2_PUBLIC_URL.replace(/\/$/, "") + "/" : null;

  for (const row of rows) {
    if (row.kind === "supabase" && row.bucket) {
      sbRows.push({ row, bucket: row.bucket, path: row.path });
    } else if (r2Base && row.path.startsWith(r2Base)) {
      const key = decodeURIComponent(row.path.slice(r2Base.length).split("?")[0]);
      if (R2_KEY_RE.test(key)) r2Rows.push({ row, key });
      else ignore.push(row.id);
    } else {
      const m = row.path.match(LEGACY_STORAGE_RE);
      if (m) sbRows.push({ row, bucket: m[1], path: decodeURIComponent(m[2].split("?")[0]) });
      else ignore.push(row.id); // not ours (external URL) — nothing to delete
    }
  }

  const done: number[] = [...ignore];
  const failedRows: QueueRow[] = [];

  // --- Cloudflare R2, up to 1000 keys per request ---
  for (let i = 0; i < r2Rows.length; i += 1000) {
    const chunk = r2Rows.slice(i, i + 1000);
    try {
      await r2.send(
        new DeleteObjectsCommand({
          Bucket: R2_BUCKET,
          Delete: { Objects: chunk.map((c) => ({ Key: c.key })), Quiet: true },
        })
      );
      done.push(...chunk.map((c) => c.row.id));
    } catch (err) {
      console.error("R2 delete failed:", err);
      failedRows.push(...chunk.map((c) => c.row));
    }
  }

  // --- Supabase Storage, grouped per bucket ---
  const byBucket = new Map<string, { row: QueueRow; path: string }[]>();
  for (const s of sbRows) {
    const list = byBucket.get(s.bucket) ?? [];
    list.push({ row: s.row, path: s.path });
    byBucket.set(s.bucket, list);
  }
  for (const [bucket, items] of byBucket) {
    const { error: rmErr } = await supabaseAdmin.storage.from(bucket).remove(items.map((i) => i.path));
    if (rmErr) {
      console.error(`Storage remove failed (${bucket}):`, rmErr.message);
      failedRows.push(...items.map((i) => i.row));
    } else {
      done.push(...items.map((i) => i.row.id));
    }
  }

  if (done.length > 0) {
    await supabaseAdmin.from("media_delete_queue").delete().in("id", done);
  }
  // Retry failures up to 5 times, then give up so the queue can't jam.
  for (const row of failedRows) {
    if (row.attempts + 1 >= 5) {
      await supabaseAdmin.from("media_delete_queue").delete().eq("id", row.id);
    } else {
      await supabaseAdmin.from("media_delete_queue").update({ attempts: row.attempts + 1 }).eq("id", row.id);
    }
  }
  return { processed: done.length, failed: failedRows.length };
}

// Removes EVERYTHING a user has under a storage prefix (used by account deletion
// as a safety net for files that were never queued, e.g. from before the queue existed).
export async function deleteR2Prefix(prefix: string): Promise<number> {
  let removed = 0;
  let token: string | undefined;
  do {
    const res: any = await r2.send(
      new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: prefix, ContinuationToken: token })
    );
    const keys: { Key: string }[] = (res.Contents ?? []).map((o: any) => ({ Key: o.Key }));
    if (keys.length > 0) {
      await r2.send(new DeleteObjectsCommand({ Bucket: R2_BUCKET, Delete: { Objects: keys, Quiet: true } }));
      removed += keys.length;
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return removed;
}

// Removes every file in <bucket>/<userId>/ using the Storage API
// (direct deletes on storage.objects are blocked by Supabase).
export async function deleteStorageFolder(bucket: string, userId: string): Promise<void> {
  for (let round = 0; round < 20; round++) {
    const { data, error } = await supabaseAdmin.storage.from(bucket).list(userId, { limit: 1000 });
    if (error || !data || data.length === 0) return;
    const paths = data.filter((f: any) => f.name).map((f: any) => `${userId}/${f.name}`);
    if (paths.length === 0) return;
    const { error: rmErr } = await supabaseAdmin.storage.from(bucket).remove(paths);
    if (rmErr) return;
  }
}
