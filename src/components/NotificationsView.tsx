"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useTopLoading } from "./TopLoadingBar";
import { ListRowSkeleton } from "./Skeleton";
import VerifiedBadge from "./VerifiedBadge";
import type { Notification } from "@/types/database";

const MESSAGES: Record<Notification["type"], (username: string) => string> = {
  like: (u) => `${u} liked your post`,
  comment: (u) => `${u} commented on your post`,
  message: (u) => `${u} sent you a message`,
  follow_request: (u) => `${u} wants to follow you`,
  follow_accepted: (u) => `${u} accepted your follow request`,
};

function linkFor(n: Notification): string {
  if (n.type === "message" && n.conversation_id) return `/chat/${n.conversation_id}`;
  if ((n.type === "follow_request" || n.type === "follow_accepted")) return "/friends";
  if (n.profiles) return `/profile/${(n.profiles as any).username}`;
  return "/";
}

export default function NotificationsView() {
  const { start, done } = useTopLoading();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    start();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("notifications")
        .select("*, profiles!notifications_actor_id_fkey(username, avatar_url, is_verified)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      setNotifications(data ?? []);

      const unreadIds = (data ?? []).filter((n) => !n.read).map((n) => n.id);
      if (unreadIds.length > 0) {
        await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
      }
    } finally {
      setLoading(false);
      done();
    }
  }

  if (loading) {
    return (
      <div className="px-4 pt-4">
        {Array.from({ length: 6 }).map((_, i) => <ListRowSkeleton key={i} />)}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="px-4 py-16 text-center">
        <h2 className="text-lg font-bold">Notifications</h2>
        <p className="mt-2 text-sm text-ink-muted">Nothing yet — likes, comments, messages, and follow activity will show up here.</p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-8 pt-4">
      <h2 className="mb-3 text-lg font-bold">Notifications</h2>
      <div className="overflow-hidden rounded-xl2 glass-card">
        {notifications.map((n, i) => {
          const actor = n.profiles as any;
          return (
            <Link
              key={n.id}
              href={linkFor(n)}
              className={`flex items-center gap-3 px-4 py-3 ${i !== 0 ? "border-t border-black/5 dark:border-white/5" : ""} ${!n.read ? "bg-brand-from/5" : ""}`}
            >
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-brand-gradient">
                {actor?.avatar_url && <img src={actor.avatar_url} alt="" className="h-full w-full object-cover" />}
              </div>
              <p className="flex-1 text-sm">
                <span className="mr-1 font-semibold">
                  {actor?.username ?? "Someone"}
                  {actor?.is_verified && <VerifiedBadge size={12} />}
                </span>
                {MESSAGES[n.type](actor?.username ?? "Someone").replace(actor?.username ?? "Someone", "").trim() || MESSAGES[n.type]("")}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
