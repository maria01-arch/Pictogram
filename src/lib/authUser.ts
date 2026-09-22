import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

// supabase.auth.getUser() makes a NETWORK request to Supabase Auth every time
// it is called. The feed alone was making ~3 of those per post. This returns
// the same { data: { user } } shape from the locally stored session instead
// (kept up to date by onAuthStateChange), so it costs nothing.
//
// Security note: this is only for "who am I" in the UI. Every real permission
// check still happens server-side (RLS / API routes call the real getUser()).
let cached: User | null | undefined; // undefined = not loaded yet
let inflight: Promise<User | null> | null = null;

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((_event, session) => {
    cached = session?.user ?? null;
  });
}

export async function getUserLocal(): Promise<{ data: { user: User | null } }> {
  if (cached !== undefined) return { data: { user: cached } };
  if (!inflight) {
    inflight = supabase.auth
      .getSession()
      .then(({ data }) => {
        cached = data.session?.user ?? null;
        return cached;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return { data: { user: await inflight } };
}
