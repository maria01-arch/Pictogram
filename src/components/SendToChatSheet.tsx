"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { sendWallpaperToChat } from "@/lib/gallery";
import Portal from "./Portal";
import { useScrollLock } from "@/lib/useScrollLock";
import { getUserLocal } from "@/lib/authUser";

interface Target {
  conversationId: string;
  username: string;
  avatar: string | null;
}

export default function SendToChatSheet({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) {
  useScrollLock();
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    window.history.pushState({ pictogramModal: "send-to-chat" }, "");
    const onPopState = () => onClose();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClose() {
    window.history.back();
  }

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await getUserLocal();
      if (!user) return setLoading(false);

      const { data: mine } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", user.id);
      const ids = (mine ?? []).map((m) => m.conversation_id);
      if (ids.length === 0) return setLoading(false);

      const { data: others } = await supabase
        .from("conversation_participants")
        .select("conversation_id, profiles!conversation_participants_user_id_fkey(username, avatar_url)")
        .in("conversation_id", ids)
        .neq("user_id", user.id);

      setTargets(
        (others ?? [])
          .filter((o: any) => o.profiles)
          .map((o: any) => ({ conversationId: o.conversation_id, username: o.profiles.username, avatar: o.profiles.avatar_url }))
      );
      setLoading(false);
    })();
  }, []);

  async function handleSend(t: Target) {
    setSentTo(t.conversationId);
    try {
      await sendWallpaperToChat(t.conversationId, imageUrl);
      setTimeout(handleClose, 700);
    } catch {
      setSentTo(null);
      alert("Failed to send. Try again.");
    }
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50" onClick={handleClose}>
        <div className="safe-bottom max-h-[70vh] w-full max-w-lg overflow-y-auto rounded-t-2xl glass-card" onClick={(e) => e.stopPropagation()}>
          <p className="px-4 pt-4 text-sm font-semibold text-ink-muted">Send to</p>
          {loading ? (
            <p className="px-4 py-6 text-sm text-ink-muted">Loading…</p>
          ) : targets.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-muted">No conversations yet.</p>
          ) : (
            <div className="py-2">
              {targets.map((t) => (
                <button
                  key={t.conversationId}
                  onClick={() => handleSend(t)}
                  disabled={!!sentTo}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left disabled:opacity-60"
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-brand-gradient">
                    {t.avatar && <img src={t.avatar} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <span className="flex-1 text-sm font-medium">{t.username}</span>
                  {sentTo === t.conversationId && <span className="text-xs font-semibold text-brand-from">Sent ✓</span>}
                </button>
              ))}
            </div>
          )}
          <button onClick={handleClose} className="w-full px-4 py-3.5 text-center text-[15px] font-semibold text-ink-muted">
            Cancel
          </button>
        </div>
      </div>
    </Portal>
  );
}
