import { createBrowserClient } from "@supabase/ssr";

// Untyped client for now — hand-rolled Database generics were causing
// update()/insert() calls to collapse to `never` in ways that were costly
// to debug blind (no local build available on this device). Once the
// Supabase project is live, regenerate real types with:
//   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts
// and re-add <Database> here.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export const supabase = createClient();
