"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import { getUnreadNotificationCount, getPendingFollowRequestCount, getUnreadConversationCount } from "./badgeCounts";
import { getUserLocal } from "@/lib/authUser";

export function useBadgeCounts() {
  const [notifications, setNotifications] = useState(0);
  const [chats, setChats] = useState(0);
  const [friendRequests, setFriendRequests] = useState(0);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Realtime can fire many events at once (e.g. every message anyone sends);
  // collapse a burst into a single refresh.
  function refreshSoon() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      refresh();
    }, 800);
  }

  async function refresh() {
    const [n, c, f] = await Promise.all([
      getUnreadNotificationCount(),
      getUnreadConversationCount(),
      getPendingFollowRequestCount(),
    ]);
    setNotifications(n);
    setChats(c);
    setFriendRequests(f);
  }

  useEffect(() => {
    refresh();

    let channels: ReturnType<typeof supabase.channel>[] = [];

    getUserLocal().then(({ data: { user } }) => {
      if (!user) return;

      channels = [
        supabase
          .channel(`badge-notifications:${user.id}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, refreshSoon)
          .subscribe(),
        supabase
          .channel(`badge-follows:${user.id}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "follows", filter: `following_id=eq.${user.id}` }, refreshSoon)
          .subscribe(),
        supabase
          .channel(`badge-messages:${user.id}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, refreshSoon)
          .subscribe(),
      ];
    });

    return () => {
      if (timer.current) clearTimeout(timer.current);
      channels.forEach((c) => supabase.removeChannel(c));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { notifications, chats, friendRequests, refresh };
}
