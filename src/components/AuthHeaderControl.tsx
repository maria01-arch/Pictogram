"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// Only ever rendered for a signed-in user now that middleware gates every
// page — no logged-out state to handle here anymore.
export default function AuthHeaderControl() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  if (!signedIn) return null;

  return (
    <button
      onClick={handleLogout}
      className="rounded-full bg-black/5 px-3 py-1.5 text-xs font-semibold text-ink-muted dark:bg-white/10"
    >
      Log out
    </button>
  );
}
