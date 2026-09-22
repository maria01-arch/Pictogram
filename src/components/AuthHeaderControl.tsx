"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getUserLocal } from "@/lib/authUser";

export default function AuthHeaderControl() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    getUserLocal().then(({ data }) => setSignedIn(!!data.user));
  }, []);

  if (!signedIn) return null;

  return (
    <Link
      href="/menu"
      aria-label="Open menu"
      className="rounded-full bg-black/5 p-2.5 text-black backdrop-blur-sm transition hover:bg-black/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
        <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
      </svg>
    </Link>
  );
}
