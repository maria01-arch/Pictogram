"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const MESSAGES: Record<string, string> = {
  like: "liked your post",
  comment: "commented on your post",
  message: "sent you a message",
  follow_request: "wants to follow you",
  follow_accepted: "accepted your follow request",
};

export default function RealtimeNotificationListener() {
  const [debug, setDebug] = useState("starting…");

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setDebug("no logged-in user");
        return;
      }

      const notifSupported = typeof window !== "undefined" && "Notification" in window;
      let permission = notifSupported ? Notification.permission : "API not present";

      // Call the RAW native API directly — not through OneSignal's wrapper.
      // webtoapp's bridge watches window.Notification.requestPermission()
      // itself, and OneSignal's own permission flow apparently doesn't
      // trigger it inside this specific WebView.
      if (notifSupported && permission === "default") {
        try {
          permission = await Notification.requestPermission();
        } catch (e) {
          setDebug((d) => d + ` | requestPermission threw: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      setDebug(`user ${user.id.slice(0, 8)}… | Notification API present: ${notifSupported} | permission: ${permission} | subscribing to realtime…`);

      channel = supabase
        .channel(`user-notifications:${user.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          async (payload) => {
            setDebug((d) => d + " | EVENT RECEIVED!");
            try {
              const notif = payload.new as { type: string; actor_id: string };

              if (!notifSupported) {
                setDebug((d) => d + " | Notification API not supported, stopping.");
                return;
              }
              // Skipping the permission gate entirely as a test — this
              // WebView's Notification.permission may just be a broken
              // stub that always reports "default" regardless of the
              // actual bridge's behavior.
              setDebug((d) => d + ` | (permission check skipped, was: ${Notification.permission}) attempting call…`);

              const { data: actor } = await supabase
                .from("profiles")
                .select("username")
                .eq("id", notif.actor_id)
                .single();

              const body = `${actor?.username ?? "Someone"} ${MESSAGES[notif.type] ?? "sent you an update"}`;
              new Notification("Pictogram", { body });
              setDebug((d) => d + " | new Notification() called successfully.");
            } catch (e) {
              setDebug((d) => d + ` | ERROR: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
        )
        .subscribe((status) => {
          setDebug((d) => d + ` | channel status: ${status}`);
        });
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="fixed bottom-32 left-2 right-2 z-[200] break-words rounded-xl2 bg-black/80 p-2 text-[10px] text-white">
      {debug}
    </div>
  );
}
