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

// Complements OneSignal's real push (which needs a service worker, and
// doesn't work in every WebView wrapper — confirmed some third-party
// "web to app" tools have broken or incomplete Notification bridges).
// This listens for new notification rows via Supabase Realtime and fires
// the plain browser Notification API whenever the app is actually open,
// which works in any environment where that API is genuinely functional
// (real browser tabs, installed PWAs).
export default function RealtimeNotificationListener() {
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;

      const notifSupported = typeof window !== "undefined" && "Notification" in window;
      if (notifSupported && Notification.permission === "default") {
        try {
          await Notification.requestPermission();
        } catch {
          // Some environments' Notification API is non-functional or
          // incomplete — fail silently rather than break the app.
        }
      }

      channel = supabase
        .channel(`user-notifications:${user.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          async (payload) => {
            try {
              if (!notifSupported || Notification.permission !== "granted") return;

              const notif = payload.new as { type: string; actor_id: string };
              const { data: actor } = await supabase
                .from("profiles")
                .select("username")
                .eq("id", notif.actor_id)
                .single();

              const body = `${actor?.username ?? "Someone"} ${MESSAGES[notif.type] ?? "sent you an update"}`;
              new Notification("Pictogram", { body });
            } catch {
              // Best-effort — never let a broken bridge crash the listener.
            }
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
