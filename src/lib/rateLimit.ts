import { supabaseAdmin } from "./supabaseAdmin";

// Server-only. Simple "N calls per window per user" limiter backed by the
// api_usage table (created in 01_security_and_reports.sql).
// Fails OPEN on database errors so a missing table never takes the app down.
export async function rateLimit(
  userId: string,
  kind: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { count, error } = await supabaseAdmin
    .from("api_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", kind)
    .gte("created_at", since);

  if (error) {
    console.error("rateLimit lookup failed (allowing request):", error.message);
    return true;
  }
  if ((count ?? 0) >= max) return false;

  await supabaseAdmin.from("api_usage").insert({ user_id: userId, kind });
  return true;
}
