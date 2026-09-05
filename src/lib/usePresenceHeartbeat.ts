"use client";

import { useEffect } from "react";
import { supabase } from "./supabaseClient";

const HEARTBEAT_MS = 25_000;

// Mount once (in AppChrome) for the lifetime of the authenticated app.
export function usePresenceHeartbeat() {
  useEffect(() => {
    let userId: string | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function beat() {
      if (!userId || document.visibilityState !== "visible") return;
      await supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", userId);
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      userId = user.id;
      beat();
      interval = setInterval(beat, HEARTBEAT_MS);
      document.addEventListener("visibilitychange", beat);
    });

    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", beat);
    };
  }, []);
}
