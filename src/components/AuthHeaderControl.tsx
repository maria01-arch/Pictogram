"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function AuthHeaderControl() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, []);

  if (!signedIn) return null;

  return (
    <Link
      href="/menu"
      aria-label="Open menu"
      className="rounded-full p-2 text-ink-light transition hover:bg-black/5 dark:text-ink-dark dark:hover:bg-white/10"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
      </svg>
    </Link>
  );
}
