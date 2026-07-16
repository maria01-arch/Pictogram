import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

// Singleton browser client — safe to import anywhere in client components.
// For server components / route handlers, create a separate server client
// with createServerClient from @supabase/ssr using cookies().
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export const supabase = createClient();
