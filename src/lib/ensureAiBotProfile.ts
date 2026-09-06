import { supabaseAdmin } from "./supabaseAdmin";

export const AI_BOT_USERNAME = "ai_assistant";
const AI_BOT_EMAIL = "ai-assistant@pictogram.internal";

// Cheap in-memory cache for a warm serverless instance — falls back to the
// DB lookup on every cold start, which is fine, it's one indexed query.
let cachedBotId: string | null = null;

export async function ensureAiBotProfile(): Promise<string> {
  if (cachedBotId) return cachedBotId;

  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("username", AI_BOT_USERNAME)
    .maybeSingle();

  if (existing) {
    cachedBotId = existing.id;
    return existing.id;
  }

  // profiles.id is a foreign key into auth.users, so the bot needs a real
  // (if never-logged-into) auth user behind it — created via the admin API
  // so all of Supabase's required auth fields are filled in correctly.
  // The on_auth_user_created trigger then creates the matching profiles row
  // automatically from this metadata.
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: AI_BOT_EMAIL,
    email_confirm: true,
    password: crypto.randomUUID(),
    user_metadata: { username: AI_BOT_USERNAME, display_name: "AI Assistant" },
  });
  if (error || !created.user) {
    throw new Error("Failed to provision AI bot account: " + (error?.message ?? "unknown error"));
  }

  await supabaseAdmin
    .from("profiles")
    .update({ is_verified: true, bio: "Your AI assistant on Next Social. Ask me anything!" })
    .eq("id", created.user.id);

  cachedBotId = created.user.id;
  return created.user.id;
}
