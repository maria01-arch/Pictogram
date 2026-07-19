"use client";

import { useEffect, useRef, useState } from "react";
import { useViewportHeight } from "@/lib/useViewportHeight";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBlockStatus } from "@/lib/block";
import { uploadChatImage } from "@/lib/uploadChatImage";
import VerifiedBadge from "./VerifiedBadge";
import type { Message, MessageReaction, Profile } from "@/types/database";
import type { RealtimeChannel } from "@supabase/supabase-js";

const TYPING_TIMEOUT_MS = 2500;
const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

interface MenuState {
  message: Message;
  x: number;
  y: number;
}

export default function ChatThreadView({ conversationId }: { conversationId: string }) {
  useViewportHeight();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  const [draft, setDraft] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [blocked, setBlocked] = useState({ blockedByMe: false, blockedMe: false });
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const otherTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    init().then((fn) => { cleanup = fn; });
    return () => cleanup?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: participants } = await supabase
      .from("conversation_participants")
      .select("user_id, profiles!conversation_participants_user_id_fkey(*)")
      .eq("conversation_id", conversationId);

    const other = (participants ?? []).find((p: any) => p.user_id !== user.id);
    if (other) {
      const profile = (other as any).profiles as Profile;
      setOtherProfile(profile);
      getBlockStatus(profile.id).then(setBlocked);
    }

    const { data: msgs } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setMessages(msgs ?? []);

    if (msgs && msgs.length > 0) {
      const { data: reacts } = await supabase
        .from("message_reactions")
        .select("*")
        .in("message_id", msgs.map((m) => m.id));
      setReactions(reacts ?? []);
    }

    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const deletedId = (payload.old as Message).id;
          setMessages((prev) => prev.filter((m) => m.id !== deletedId));
        }
      )
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload.userId === user.id) return;
        setOtherTyping(true);
        if (otherTypingTimeoutRef.current) clearTimeout(otherTypingTimeoutRef.current);
        otherTypingTimeoutRef.current = setTimeout(() => setOtherTyping(false), TYPING_TIMEOUT_MS);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      if (otherTypingTimeoutRef.current) clearTimeout(otherTypingTimeoutRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function handleDraftChange(value: string) {
    setDraft(value);
    if (!userId || !channelRef.current) return;
    channelRef.current.send({ type: "broadcast", event: "typing", payload: { userId } });
  }

  async function sendMessage() {
    const content = draft.trim();
    if (!content || !userId) return;

    if (editingMessage) {
      setDraft("");
      const editedAt = new Date().toISOString();
      setMessages((prev) => prev.map((m) => (m.id === editingMessage.id ? { ...m, content, edited_at: editedAt } : m)));
      setEditingMessage(null);
      await supabase.from("messages").update({ content, edited_at: editedAt }).eq("id", editingMessage.id);
      return;
    }

    setDraft("");
    const replyToId = replyingTo?.id ?? null;
    setReplyingTo(null);

    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage: Message = {
      id: optimisticId,
      conversation_id: conversationId,
      sender_id: userId,
      content,
      media_url: null,
      reply_to_id: replyToId,
      edited_at: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: userId, content, reply_to_id: replyToId })
      .select("*")
      .single();

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      return;
    }

    setMessages((prev) => prev.map((m) => (m.id === optimisticId ? data : m)));
  }

  async function handleImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setAttachMenuOpen(false);
    if (!file || !userId) return;

    setUploadingImage(true);
    try {
      const mediaUrl = await uploadChatImage(file);
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: userId,
        content: null,
        media_url: mediaUrl,
      });
    } catch {
      alert("Failed to send image. Try again.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function startLongPress(message: Message, x: number, y: number) {
    longPressFiredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setMenu({ message, x, y });
    }, 450);
  }
  function cancelLongPress() {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  }
  function handleImageTap(mediaUrl: string) {
    // A long-press still fires a trailing click on release — if the menu
    // already opened from the long-press, swallow this tap instead of
    // also opening the lightbox on top of it (that's what caused the freeze).
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    setLightboxUrl(mediaUrl);
  }

  async function toggleReaction(message: Message, emoji: string) {
    if (!userId) return;
    // One reaction per user per message: tapping the same emoji again
    // removes it, tapping a different emoji replaces the existing one.
    const existing = reactions.find((r) => r.message_id === message.id && r.user_id === userId);
    setMenu(null);

    if (existing && existing.emoji === emoji) {
      setReactions((prev) => prev.filter((r) => !(r.message_id === message.id && r.user_id === userId)));
      await supabase.from("message_reactions").delete().eq("message_id", message.id).eq("user_id", userId);
      return;
    }

    setReactions((prev) => [
      ...prev.filter((r) => !(r.message_id === message.id && r.user_id === userId)),
      { message_id: message.id, user_id: userId, emoji, created_at: new Date().toISOString() },
    ]);
    await supabase
      .from("message_reactions")
      .upsert({ message_id: message.id, user_id: userId, emoji }, { onConflict: "message_id,user_id" });
  }

  function handleCopy(message: Message) {
    if (message.content) navigator.clipboard.writeText(message.content);
    setMenu(null);
  }
  function handleReply(message: Message) {
    setReplyingTo(message);
    setEditingMessage(null);
    setMenu(null);
  }
  function handleEdit(message: Message) {
    setEditingMessage(message);
    setReplyingTo(null);
    setDraft(message.content ?? "");
    setMenu(null);
  }
  async function handleDelete(message: Message) {
    setMenu(null);
    if (!confirm("Delete this message?")) return;
    setMessages((prev) => prev.filter((m) => m.id !== message.id));
    await supabase.from("messages").delete().eq("id", message.id);
  }

  function reactionsFor(messageId: string) {
    const grouped: Record<string, number> = {};
    reactions.filter((r) => r.message_id === messageId).forEach((r) => {
      grouped[r.emoji] = (grouped[r.emoji] ?? 0) + 1;
    });
    return grouped;
  }
  function quotedContent(replyToId: string | null) {
    if (!replyToId) return null;
    return messages.find((m) => m.id === replyToId)?.content ?? null;
  }

  const canMessage = !blocked.blockedByMe && !blocked.blockedMe;

  return (
    <div className="flex flex-col" style={{ height: "var(--app-height, 100dvh)" }}>
      <header className="flex shrink-0 items-center gap-2.5 border-b border-black/5 px-3 py-2 dark:border-white/5">
        <button onClick={() => router.back()} aria-label="Back" className="shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {otherProfile && (
          <Link href={`/profile/${otherProfile.username}`} className="flex flex-1 items-center gap-2 overflow-hidden">
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-brand-gradient">
              {otherProfile.avatar_url && <img src={otherProfile.avatar_url} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1 truncate text-sm font-semibold">
                {otherProfile.username}
                {otherProfile.is_verified && <VerifiedBadge size={12} />}
              </p>
              {otherTyping && <p className="text-[11px] text-brand-from">typing…</p>}
            </div>
          </Link>
        )}
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2.5 no-scrollbar">
        {messages.map((m) => {
          const mine = m.sender_id === userId;
          const grouped = reactionsFor(m.id);
          const quote = quotedContent(m.reply_to_id);

          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              {m.media_url ? (
                <button
                  onClick={() => handleImageTap(m.media_url!)}
                  onTouchStart={(e) => startLongPress(m, e.touches[0].clientX, e.touches[0].clientY)}
                  onTouchEnd={cancelLongPress}
                  onTouchMove={cancelLongPress}
                  onContextMenu={(e) => { e.preventDefault(); setMenu({ message: m, x: e.clientX, y: e.clientY }); }}
                  className="max-w-[65%] overflow-hidden rounded-2xl border border-black/10 dark:border-white/15"
                >
                  <img
                    src={m.media_url}
                    alt=""
                    draggable={false}
                    className="max-h-64 w-full select-none object-cover"
                    style={{ WebkitTouchCallout: "none" } as React.CSSProperties}
                  />
                </button>
              ) : (
                <div
                  onTouchStart={(e) => startLongPress(m, e.touches[0].clientX, e.touches[0].clientY)}
                  onTouchEnd={cancelLongPress}
                  onTouchMove={cancelLongPress}
                  onContextMenu={(e) => { e.preventDefault(); setMenu({ message: m, x: e.clientX, y: e.clientY }); }}
                  className={`max-w-[75%] select-none break-words rounded-2xl px-4 py-2.5 text-[15px] leading-snug ${
                    mine ? "bg-brand-gradient text-white" : "bg-black/5 dark:bg-white/10"
                  }`}
                >
                  {quote && (
                    <p className={`mb-1 truncate border-l-2 pl-2 text-xs opacity-75 ${mine ? "border-white/60" : "border-black/20 dark:border-white/30"}`}>
                      {quote}
                    </p>
                  )}
                  {m.content}
                  {m.edited_at && <span className="ml-1.5 text-[10px] opacity-60">(edited)</span>}
                </div>
              )}

              {Object.keys(grouped).length > 0 && (
                <div className="mt-0.5 flex gap-1">
                  {Object.entries(grouped).map(([emoji, count]) => (
                    <span key={emoji} className="rounded-full bg-black/5 px-1.5 py-0.5 text-[11px] dark:bg-white/10">
                      {emoji} {count > 1 ? count : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {replyingTo && (
        <div className="flex items-center gap-2 border-t border-black/5 px-3 py-1.5 dark:border-white/5">
          <div className="min-w-0 flex-1 border-l-2 border-brand-from pl-2 text-xs text-ink-muted">
            <p className="truncate">Replying to: {replyingTo.content}</p>
          </div>
          <button onClick={() => setReplyingTo(null)} className="text-ink-muted">✕</button>
        </div>
      )}
      {editingMessage && (
        <div className="flex items-center gap-2 border-t border-black/5 px-3 py-1.5 dark:border-white/5">
          <p className="flex-1 text-xs text-ink-muted">Editing message</p>
          <button onClick={() => { setEditingMessage(null); setDraft(""); }} className="text-ink-muted">✕</button>
        </div>
      )}
      {uploadingImage && (
        <div className="border-t border-black/5 px-3 py-1.5 text-xs text-ink-muted dark:border-white/5">Sending image…</div>
      )}

      {!canMessage ? (
        <div className="shrink-0 border-t border-black/5 px-3 py-3 text-center text-sm text-ink-muted dark:border-white/5">
          {blocked.blockedByMe ? "You've blocked this user." : "You can't message this user."}
        </div>
      ) : (
        <div className="relative flex shrink-0 items-center gap-2 border-t border-black/5 px-2.5 py-2 dark:border-white/5">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelected} className="hidden" />

          <button
            onClick={() => setAttachMenuOpen((o) => !o)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/5 text-ink-muted dark:bg-white/10"
            aria-label="Attach"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </button>

          {attachMenuOpen && (
            <div className="absolute bottom-12 left-2 z-20 w-44 overflow-hidden rounded-xl2 glass-card shadow-lg">
              <button
                onClick={() => { setAttachMenuOpen(false); fileInputRef.current?.click(); }}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm"
              >
                🖼️ Image
              </button>
              <button
                onClick={() => { setAttachMenuOpen(false); alert("Voice notes are coming soon."); }}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm"
              >
                🎤 Voice note
              </button>
            </div>
          )}

          <input
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Message…"
            className="flex-1 rounded-full bg-black/5 px-3.5 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-from dark:bg-white/10"
          />
          <button
            onClick={sendMessage}
            disabled={!draft.trim()}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-gradient text-white disabled:opacity-40"
            aria-label="Send message"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
            </svg>
          </button>
        </div>
      )}

      {menu && (
        <div className="fixed inset-0 z-50" onClick={() => setMenu(null)}>
          <div
            className="absolute w-52 overflow-hidden rounded-xl2 glass-card shadow-lg"
            style={{ left: Math.min(menu.x, window.innerWidth - 220), top: Math.min(menu.y, window.innerHeight - 260) }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-around border-b border-black/5 px-2 py-2 dark:border-white/5">
              {QUICK_EMOJIS.map((emoji) => (
                <button key={emoji} onClick={() => toggleReaction(menu.message, emoji)} className="text-lg">
                  {emoji}
                </button>
              ))}
            </div>
            {menu.message.content && (
              <>
                <button onClick={() => handleReply(menu.message)} className="w-full px-4 py-2.5 text-left text-sm">Reply</button>
                <button onClick={() => handleCopy(menu.message)} className="w-full px-4 py-2.5 text-left text-sm">Copy</button>
              </>
            )}
            {menu.message.sender_id === userId && (
              <>
                {menu.message.content && (
                  <button onClick={() => handleEdit(menu.message)} className="w-full px-4 py-2.5 text-left text-sm">Edit</button>
                )}
                <button onClick={() => handleDelete(menu.message)} className="w-full px-4 py-2.5 text-left text-sm text-red-500">Delete</button>
              </>
            )}
          </div>
        </div>
      )}

      {lightboxUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="" className="max-h-[85vh] max-w-[92vw] object-contain" />
          <button onClick={() => setLightboxUrl(null)} className="absolute right-4 top-5 text-white">✕</button>
        </div>
      )}
    </div>
  );
}
