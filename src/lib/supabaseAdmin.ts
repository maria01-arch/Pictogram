import { createClient } from "@supabase/supabase-js";

// Server-only — NEVER import this from a client component. This bypasses
// RLS entirely, so it's used only for the two things a normal user session
// can't do: provisioning the AI bot's account, and inserting the AI bot's
// replies (which can't come from a real auth session since the bot has no
// browser of its own).
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
