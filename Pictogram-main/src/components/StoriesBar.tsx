"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import StoryViewer from "./StoryViewer";
import type { Story } from "@/types/database";

interface UserStories {
  username: string;
  avatar_url: string | null;
  stories: Story[];
}

export default function StoriesBar() {
  const [groups, setGroups] = useState<UserStories[]>([]);
  const [viewing, setViewing] = useState<UserStories | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("stories")
        .select("*, profiles!stories_user_id_fkey(username, avatar_url)")
        .order("created_at", { ascending: true });

      const byUser = new Map<string, UserStories>();
      (data ?? []).forEach((story: any) => {
        const key = story.profiles?.username;
        if (!key) return;
        if (!byUser.has(key)) {
          byUser.set(key, { username: key, avatar_url: story.profiles.avatar_url, stories: [] });
        }
        byUser.get(key)!.stories.push(story);
      });

      setGroups(Array.from(byUser.values()));
    }
    load();
  }, []);

  if (groups.length === 0) {
    return (
      <div className="flex gap-4 overflow-x-auto px-4 pt-3 no-scrollbar">
        <Link href="/create" className="flex flex-col items-center gap-1">
          <div className="grid h-16 w-16 place-items-center rounded-full border-2 border-dashed border-black/15 text-ink-muted dark:border-white/15">
            +
          </div>
          <span className="text-xs text-ink-muted">Add story</span>
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-4 overflow-x-auto px-4 pt-3 no-scrollbar">
        <Link href="/create" className="flex shrink-0 flex-col items-center gap-1">
          <div className="grid h-16 w-16 place-items-center rounded-full border-2 border-dashed border-black/15 text-ink-muted dark:border-white/15">
            +
          </div>
          <span className="text-xs text-ink-muted">Add story</span>
        </Link>

        {groups.map((g) => (
          <button key={g.username} onClick={() => setViewing(g)} className="flex shrink-0 flex-col items-center gap-1">
            <div className="h-16 w-16 rounded-full bg-brand-gradient p-0.5">
              <div className="h-full w-full overflow-hidden rounded-full border-2 border-surface-lightMuted dark:border-surface-darkMuted">
                {g.avatar_url && <img src={g.avatar_url} alt="" className="h-full w-full object-cover" />}
              </div>
            </div>
            <span className="max-w-[64px] truncate text-xs">{g.username}</span>
          </button>
        ))}
      </div>

      {viewing && (
        <StoryViewer stories={viewing.stories} username={viewing.username} onClose={() => setViewing(null)} />
      )}
    </>
  );
}
