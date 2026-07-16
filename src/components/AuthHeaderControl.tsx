"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthHeaderControl() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(!!data.user);
      setChecking(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  if (checking) return <div className="h-8 w-8" />;

  return signedIn ? (
    <button
      onClick={handleLogout}
      className="rounded-full bg-black/5 px-3 py-1.5 text-xs font-semibold text-ink-muted dark:bg-white/10"
    >
      Log out
    </button>
  ) : (
    <Link
      href="/auth/login"
      className="rounded-full bg-brand-gradient px-3 py-1.5 text-xs font-semibold text-white"
    >
      Sign in
    </Link>
  );
}
