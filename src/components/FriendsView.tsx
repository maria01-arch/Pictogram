"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Profile } from "@/types/database";

type Tab = "requests" | "friends" | "suggestions";

export default function FriendsView() {
  const [tab, setTab] = useState<Tab>("requests");
  const [requests, setRequests] = useState<{ id: string; profile: Profile }[]>([]);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setLoading(false);

    const { data: pendingRows } = await supabase
      .from("follows")
      .select("follower_id, profiles!follows_follower_id_fkey(*)")
      .eq("following_id", user.id)
      .eq("status", "pending");
    setRequests(
      (pendingRows ?? []).map((r: any) => ({ id: r.follower_id, profile: r.profiles }))
    );

    const { data: acceptedRows } = await supabase
      .from("follows")
      .select("follower_id, following_id, profiles!follows_follower_id_fkey(*), profiles_following:follows_following_id_fkey(*)")
      .or(`follower_id.eq.${user.id},following_id.eq.${user.id}`)
      .eq("status", "accepted");

    const friendMap = new Map<string, Profile>();
    (acceptedRows ?? []).forEach((r: any) => {
      const other = r.follower_id === user.id ? r.profiles_following : r.profiles;
      if (other) friendMap.set(other.id, other);
    });
    setFriends(Array.from(friendMap.values()));

    const excludeIds = new Set([user.id, ...friendMap.keys(), ...requests.map((r) => r.id)]);
    const { data: allProfiles } = await supabase.from("profiles").select("*").limit(30);
    setSuggestions((allProfiles ?? []).filter((p) => !excludeIds.has(p.id)));

    setLoading(false);
  }

  async function accept(followerId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("follows").update({ status: "accepted" }).eq("follower_id", followerId).eq("following_id", user.id);
    load();
  }

  async function decline(followerId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("follows").delete().eq("follower_id", followerId).eq("following_id", user.id);
    load();
  }

  async function followBack(targetId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("follows").insert({ follower_id: user.id, following_id: targetId, status: "accepted" });
    load();
  }

  return (
    <div className="pb-8">
      <div className="flex gap-2 px-4 pt-4">
        {(["requests", "friends", "suggestions"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold capitalize ${
              tab === t ? "bg-brand-gradient text-white" : "bg-black/5 text-ink-muted dark:bg-white/10"
            }`}
          >
            {t === "requests" ? "Follow requests" : t}
          </button>
        ))}
      </div>

      <div className="mt-4 px-4">
        {loading && <p className="text-sm text-ink-muted">Loading…</p>}

        {!loading && tab === "requests" && (
          requests.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-muted">No pending follow requests.</p>
          ) : (
            requests.map((r) => (
              <div key={r.id} className="mb-2 flex items-center gap-3 rounded-xl2 glass-card px-3 py-2.5">
                <Link href={`/profile/${r.profile.username}`} className="flex flex-1 items-center gap-3">
                  <div className="h-10 w-10 overflow-hidden rounded-full bg-brand-gradient">
                    {r.profile.avatar_url && <img src={r.profile.avatar_url} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <p className="text-sm font-semibold">{r.profile.username}</p>
                </Link>
                <button onClick={() => accept(r.id)} className="rounded-full bg-brand-gradient px-3 py-1.5 text-xs font-semibold text-white">
                  Accept
                </button>
                <button onClick={() => decline(r.id)} className="rounded-full bg-black/5 px-3 py-1.5 text-xs font-semibold dark:bg-white/10">
                  Decline
                </button>
              </div>
            ))
          )
        )}

        {!loading && tab === "friends" && (
          friends.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-muted">No friends yet.</p>
          ) : (
            friends.map((f) => (
              <Link key={f.id} href={`/profile/${f.username}`} className="mb-2 flex items-center gap-3 rounded-xl2 glass-card px-3 py-2.5">
                <div className="h-10 w-10 overflow-hidden rounded-full bg-brand-gradient">
                  {f.avatar_url && <img src={f.avatar_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <p className="text-sm font-semibold">{f.username}</p>
              </Link>
            ))
          )
        )}

        {!loading && tab === "suggestions" && (
          suggestions.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-muted">No suggestions right now.</p>
          ) : (
            suggestions.map((s) => (
              <div key={s.id} className="mb-2 flex items-center gap-3 rounded-xl2 glass-card px-3 py-2.5">
                <Link href={`/profile/${s.username}`} className="flex flex-1 items-center gap-3">
                  <div className="h-10 w-10 overflow-hidden rounded-full bg-brand-gradient">
                    {s.avatar_url && <img src={s.avatar_url} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <p className="text-sm font-semibold">{s.username}</p>
                </Link>
                <button onClick={() => followBack(s.id)} className="rounded-full bg-brand-gradient px-3 py-1.5 text-xs font-semibold text-white">
                  Follow
                </button>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
