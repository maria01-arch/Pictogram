"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { getUnreadNotificationCount, getPendingFollowRequestCount, getUnreadConversationCount } from "./badgeCounts";

export function useBadgeCounts() {
  const [notifications, setNotifications] = useState(0);
  const [chats, setChats] = useState(0);
  const [friendRequests, setFriendRequests] = useState(0);

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

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      channels = [
        supabase
          .channel(`badge-notifications:${user.id}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, refresh)
          .subscribe(),
        supabase
          .channel(`badge-follows:${user.id}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "follows", filter: `following_id=eq.${user.id}` }, refresh)
          .subscribe(),
        supabase
          .channel(`badge-messages:${user.id}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, refresh)
          .subscribe(),
      ];
    });

    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { notifications, chats, friendRequests, refresh };
}
