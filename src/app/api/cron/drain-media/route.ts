import { NextResponse } from "next/server";
import { drainMediaQueue } from "@/lib/mediaQueue";

export const maxDuration = 60;

// Runs daily from vercel.json. Vercel sends "Authorization: Bearer <CRON_SECRET>"
// automatically once you add a CRON_SECRET environment variable.
// Cleans up files of expired stories, deleted accounts, etc.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let total = 0;
  for (let i = 0; i < 5; i++) {
    const { processed, failed } = await drainMediaQueue(200);
    total += processed;
    if (processed + failed < 200) break;
  }
  return NextResponse.json({ ok: true, processed: total });
}
