// supabase/functions/moderate-media/index.ts
//
// Called right after a post/story row is created. Scans the media with
// Sightengine and flips moderation_status to 'approved' or 'flagged'.
// Runs with the service-role key, so it bypasses RLS — this is the ONLY
// path that can move a row out of 'pending' (see add_content_moderation.sql).
//
// Required secrets (set with `supabase secrets set`):
//   SIGHTENGINE_API_USER
//   SIGHTENGINE_API_SECRET
//   SB_SERVICE_ROLE_KEY   (the project's service_role key — NOT the anon key)
//
// Deploy with: supabase functions deploy moderate-media

import { createClient } from "npm:@supabase/supabase-js@2";

interface RequestBody {
  table: "posts" | "stories";
  id: string;
  mediaUrl: string; // public URL of the image to scan (use thumbnail_url for video/carousel)
}

// Tune these if you're seeing too many false positives/negatives once you
// have real traffic. Sightengine returns a 0-1 probability per category.
const THRESHOLDS = {
  sexualActivity: 0.5,
  sexualDisplay: 0.5,
  gore: 0.6,
  violence: 0.6,
};

Deno.serve(async (req) => {
  try {
    const { table, id, mediaUrl } = (await req.json()) as RequestBody;
    if (!table || !id || !mediaUrl) {
      return new Response(JSON.stringify({ error: "table, id, and mediaUrl are required" }), { status: 400 });
    }
    if (table !== "posts" && table !== "stories") {
      return new Response(JSON.stringify({ error: "invalid table" }), { status: 400 });
    }

    const apiUser = Deno.env.get("SIGHTENGINE_API_USER");
    const apiSecret = Deno.env.get("SIGHTENGINE_API_SECRET");
    if (!apiUser || !apiSecret) {
      return new Response(JSON.stringify({ error: "Sightengine credentials not configured" }), { status: 500 });
    }

    const sightengineUrl = new URL("https://api.sightengine.com/1.0/check.json");
    sightengineUrl.searchParams.set("url", mediaUrl);
    sightengineUrl.searchParams.set("models", "nudity-2.1,offensive,gore,violence");
    sightengineUrl.searchParams.set("api_user", apiUser);
    sightengineUrl.searchParams.set("api_secret", apiSecret);

    const result = await fetch(sightengineUrl.toString()).then((r) => r.json());

    if (result.status !== "success") {
      // Fail closed on API errors: leave it pending rather than silently
      // publishing unscanned content. A cron/manual sweep can retry these.
      return new Response(JSON.stringify({ error: "moderation API error", detail: result }), { status: 502 });
    }

    const nudity = result.nudity ?? {};
    const flagged =
      (nudity.sexual_activity ?? 0) > THRESHOLDS.sexualActivity ||
      (nudity.sexual_display ?? 0) > THRESHOLDS.sexualDisplay ||
      (result.gore?.prob ?? 0) > THRESHOLDS.gore ||
      (result.violence?.prob ?? 0) > THRESHOLDS.violence;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SB_SERVICE_ROLE_KEY")!
    );

    const { data: row, error: fetchError } = await supabase
      .from(table)
      .update({ moderation_status: flagged ? "flagged" : "approved" })
      .eq("id", id)
      .select("user_id")
      .single();
    if (fetchError) throw fetchError;

    if (flagged && row) {
      await supabase.from("account_strikes").insert({
        user_id: row.user_id,
        guideline_violated: "Automated content moderation",
        reason: `Uploaded media was automatically flagged (${JSON.stringify(result)})`,
        evidence_url: mediaUrl,
        status: "active",
      });
    }

    return new Response(JSON.stringify({ flagged }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
