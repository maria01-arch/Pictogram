"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

const MESSAGES: Record<string, string> = {
  like: "liked your post",
  comment: "commented on your post",
  message: "sent you a message",
  follow_request: "wants to follow you",
  follow_accepted: "accepted your follow request",
};

// Complements OneSignal's real push (which needs a service worker and
// doesn't work in every WebView wrapper). This listens for new
// notification rows via Supabase Realtime (already enabled on this
// table) and fires the plain browser Notification API — the same
// mechanism webtoapp's "Web Notification" bridge maps to a native
// Android notification, and it works whenever the app is actually open,
// with or without service worker/push support.
export default function RealtimeNotificationListener() {
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      channel = supabase
        .channel(`user-notifications:${user.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          async (payload) => {
            const notif = payload.new as { type: string; actor_id: string };

            if (typeof window === "undefined" || !("Notification" in window)) return;
            if (Notification.permission !== "granted") return;

            const { data: actor } = await supabase
              .from("profiles")
              .select("username")
              .eq("id", notif.actor_id)
              .single();

            const body = `${actor?.username ?? "Someone"} ${MESSAGES[notif.type] ?? "sent you an update"}`;
            new Notification("Pictogram", { body });
          }
        )
        .subscribe();
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
