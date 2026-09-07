"use client";

import { useEffect, useRef, useState } from "react";
import { useViewportHeight } from "@/lib/useViewportHeight";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBlockStatus } from "@/lib/block";
import { createNotification } from "@/lib/notifications";
import { markConversationRead } from "@/lib/badgeCounts";
import { isOnline } from "@/lib/presence";
import { AI_BOT_USERNAME } from "@/lib/aiBot";
import { uploadChatImage, resolveChatMediaUrl } from "../lib/uploadChatImage";
import { uploadChatVoice, isVoiceNotePath } from "@/lib/uploadChatVoice";
import VoiceRecordBar from "./VoiceRecordBar";
import ChatVoiceNote from "./ChatVoiceNote";
import ConfirmModal from "./ConfirmModal";
import ImageEditor from "./ImageEditor";
import Portal from "./Portal";
import VerifiedBadge from "./VerifiedBadge";
import EmojiText from "./EmojiText";
import { useTopLoading } from "./TopLoadingBar";
import { ChatSkeleton } from "./Skeleton";
import { isSingleEmoji } from "@/lib/emoji";
import type { Message, MessageReaction, Profile } from "@/types/database";
import type { RealtimeChannel } from "@supabase/supabase-js";

const TYPING_TIMEOUT_MS = 2500;
const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
// Consecutive messages from the same sender within this window are visually
// grouped together (tighter spacing, ticks/timestamp only on the last one).
const GROUP_GAP_MS = 60_000;

function formatBubbleTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function Ticks({ seen, light }: { seen: boolean; light?: boolean }) {
  return (
    <svg width="13" height="9" viewBox="0 0 16 10" fill="none" className={seen ? "text-brand-from" : light ? "text-white/80" : "text-ink-muted"}>
      <path d="M1 5l3 3 5-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 5l3 3 6-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface MenuState {
  message: Message;
  x: number;
  y: number;
}

// chat-media is a private bucket now — media_url on a message is a bare
// storage path, not a viewable URL. Resolve it to a short-lived signed URL
// before rendering.
function ChatImage({ path, onTap }: { path: string; onTap: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setFailed(false);
    resolveChatMediaUrl(path).then((resolved) => {
      if (cancelled) return;
      if (resolved) setUrl(resolved);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (failed) {
    return (
      <div className="flex h-24 w-48 items-center justify-center rounded-2xl bg-black/5 text-xs text-ink-muted dark:bg-white/10">
        Image unavailable
      </div>
    );
  }

  if (!url) {
    return <div className="h-40 w-48 animate-pulse rounded-2xl bg-black/5 dark:bg-white/10" />;
  }

  return (
    <img
      src={url}
      alt=""
      draggable={false}
      onClick={() => onTap(url)}
      className="max-h-64 w-full select-none object-cover"
      style={{ WebkitTouchCallout: "none" } as React.CSSProperties}
    />
  );
}

export default function ChatThreadView({ conversationId }: { conversationId: string }) {
  useViewportHeight();
  const router = useRouter();
  const { start, done } = useTopLoading();
  const [initialLoading, setInitialLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null);
  const [myReadReceiptsEnabled, setMyReadReceiptsEnabled] = useState(true);
  const [, forceTick] = useState(0); // periodic re-render so the online dot ages out on its own
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  const [draft, setDraft] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [confirmingDeleteMessage, setConfirmingDeleteMessage] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [swipeMsgId, setSwipeMsgId] = useState<string | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeLockedRef = useRef(false);
  const SWIPE_REPLY_THRESHOLD = 56;
  const SWIPE_REPLY_MAX = 72;
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [blocked, setBlocked] = useState({ blockedByMe: false, blockedMe: false });
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [editingImageFile, setEditingImageFile] = useState<File | null>(null);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
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
    start();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setInitialLoading(false);
      done();
      return;
    }
    setUserId(user.id);
    markConversationRead(conversationId);

    const [{ data: participants }, { data: msgs }] = await Promise.all([
      supabase
        .from("conversation_participants")
        .select("user_id, last_read_at, profiles!conversation_participants_user_id_fkey(*)")
        .eq("conversation_id", conversationId),
      supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true }),
    ]);

    const other = (participants ?? []).find((p: any) => p.user_id !== user.id);
    if (other) {
      const profile = (other as any).profiles as Profile;
      setOtherProfile(profile);
      setOtherLastReadAt((other as any).last_read_at ?? null);
      getBlockStatus(profile.id).then(setBlocked);
    }
    const mine = (participants ?? []).find((p: any) => p.user_id === user.id);
    if (mine) {
      setMyReadReceiptsEnabled((mine as any).profiles?.read_receipts_enabled ?? true);
    }

    setMessages(msgs ?? []);

    if (msgs && msgs.length > 0) {
      const { data: reacts } = await supabase
        .from("message_reactions")
        .select("*")
        .in("message_id", msgs.map((m) => m.id));
      setReactions(reacts ?? []);
    }

    setInitialLoading(false);
    done();

    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
          if (incoming.sender_id !== user.id) markConversationRead(conversationId);
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
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversation_participants", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as any;
          if (row.user_id !== user.id) setOtherLastReadAt(row.last_read_at ?? null);
        }
      )
      .on(
        "postgres_changes",
        other ? { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${(other as any).profiles.id}` } : { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          if (!other) return;
          const updated = payload.new as Profile;
          if (updated.id !== (other as any).profiles.id) return;
          setOtherProfile((prev) => (prev ? { ...prev, ...updated } : updated));
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      if (otherTypingTimeoutRef.current) clearTimeout(otherTypingTimeoutRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }

  const hasScrolledOnceRef = useRef(false);
  useEffect(() => {
    if (messages.length === 0) return;
    // First load of a thread: jump straight to the bottom, no animation —
    // a smooth scroll here can land short if images/avatars are still
    // laying out, which is why reopening a chat needed a manual scroll.
    // Only genuinely NEW messages after that get the smooth scroll.
    if (!hasScrolledOnceRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
      hasScrolledOnceRef.current = true;
    } else {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  useEffect(() => {
    const tick = setInterval(() => forceTick((t) => t + 1), 15_000);
    return () => clearInterval(tick);
  }, []);

  function handleDraftChange(value: string) {
    setDraft(value);
    if (!userId || !channelRef.current) return;
    channelRef.current.send({ type: "broadcast", event: "typing", payload: { userId } });
  }

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
  }, [draft]);

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

    if (otherProfile) {
      if (otherProfile.username === AI_BOT_USERNAME) {
        requestAiReply();
      } else {
        createNotification({
          targetUserId: otherProfile.id,
          type: "message",
          conversationId,
          pushTitle: "New message",
          pushBody: content.length > 60 ? content.slice(0, 60) + "…" : content,
          pushUrl: `/chat/${conversationId}`,
        });
      }
    }
  }

  async function requestAiReply() {
    setOtherTyping(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "chat", conversationId }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.message) {
        setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
      } else if (!res.ok) {
        throw new Error(data.error || "AI request failed");
      }
    } catch {
      // The route itself already tries hard to insert a real, visible
      // apology on failure — this only fires for something even more
      // fundamental (no network, request never reached the server), so a
      // local-only notice is the right fallback here.
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-error-${Date.now()}`,
          conversation_id: conversationId,
          sender_id: otherProfile?.id ?? "",
          content: "Couldn't reach the AI right now — check your connection and try again.",
          media_url: null,
          reply_to_id: null,
          edited_at: null,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setOtherTyping(false);
    }
  }

  function handleImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setAttachMenuOpen(false);
    if (!file || !userId) return;
    setEditingImageFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function sendEditedImage({ file, caption }: { file: File; caption: string }) {
    setEditingImageFile(null);
    if (!userId) return;

    setUploadingImage(true);
    try {
      const mediaUrl = await uploadChatImage(file);
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: userId,
        content: caption || null,
        media_url: mediaUrl,
      });
    } catch {
      alert("Failed to send image. Try again.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function sendVoiceNote(blob: Blob, mimeType: string) {
    setRecordingVoice(false);
    if (!userId) return;

    setUploadingVoice(true);
    try {
      const mediaUrl = await uploadChatVoice(blob, mimeType);
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: userId,
        content: null,
        media_url: mediaUrl,
      });
    } catch {
      alert("Failed to send voice note. Try again.");
    } finally {
      setUploadingVoice(false);
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

  // Swipe-right-to-reply. Runs on the whole message row (parent of the
  // bubble), alongside — not instead of — the existing long-press-to-open-menu
  // handlers on the bubble itself.
  function handleRowTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    swipeStartRef.current = { x: t.clientX, y: t.clientY };
    swipeLockedRef.current = false;
  }
  function handleRowTouchMove(m: Message, e: React.TouchEvent) {
    const start = swipeStartRef.current;
    if (!start) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    if (!swipeLockedRef.current) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        // Vertical scroll intent — this gesture isn't a swipe, stop tracking it.
        swipeStartRef.current = null;
        return;
      }
      swipeLockedRef.current = true;
    }

    setSwipeMsgId(m.id);
    setSwipeX(dx > 0 ? Math.min(dx, SWIPE_REPLY_MAX) : 0);
  }
  function handleRowTouchEnd(m: Message) {
    const committed = swipeLockedRef.current;
    swipeStartRef.current = null;
    swipeLockedRef.current = false;
    if (committed && swipeMsgId === m.id && swipeX >= SWIPE_REPLY_THRESHOLD) {
      handleReply(m);
    }
    setSwipeMsgId(null);
    setSwipeX(0);
  }
  function handleEdit(message: Message) {
    setEditingMessage(message);
    setReplyingTo(null);
    setDraft(message.content ?? "");
    setMenu(null);
  }
  async function handleDelete(message: Message) {
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
  function previewLabel(m: Message | null | undefined): string {
    if (!m) return "";
    if (m.content) return m.content;
    if (m.media_url && isVoiceNotePath(m.media_url)) return "🎤 Voice message";
    if (m.media_url) return "📷 Photo";
    return "";
  }
  function quotedContent(replyToId: string | null) {
    if (!replyToId) return null;
    const target = messages.find((m) => m.id === replyToId);
    return target ? previewLabel(target) : null;
  }

  const canMessage = !blocked.blockedByMe && !blocked.blockedMe;

  return (
    <div
      className="fixed inset-x-0 flex flex-col"
      style={{ top: "var(--app-offset-top, 0px)", height: "var(--app-height, 100dvh)" }}
    >
      <header className="safe-top flex shrink-0 items-center gap-2.5 border-b border-black/5 px-3 py-2 dark:border-white/5">
        <button onClick={() => router.back()} aria-label="Back" className="shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {otherProfile && (
          <Link href={`/profile/${otherProfile.username}`} className="flex flex-1 items-center gap-2 overflow-hidden">
            <div className="relative h-8 w-8 shrink-0">
              <div className="h-8 w-8 overflow-hidden rounded-full bg-brand-gradient">
                {otherProfile.avatar_url && <img src={otherProfile.avatar_url} alt="" className="h-full w-full object-cover" />}
              </div>
              {isOnline(otherProfile.last_seen_at) && (
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-surface-light bg-green-500 dark:border-surface-dark" />
              )}
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1 truncate text-sm font-semibold">
                {otherProfile.username}
                {otherProfile.is_verified && <VerifiedBadge size={12} />}
              </p>
              {otherTyping ? (
                <p className="text-[11px] text-brand-from">typing…</p>
              ) : isOnline(otherProfile.last_seen_at) ? (
                <p className="text-[11px] text-ink-muted">Online</p>
              ) : null}
            </div>
          </Link>
        )}
      </header>

      {initialLoading ? (
        <ChatSkeleton />
      ) : (
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5 no-scrollbar">
        {messages.length === 0 && otherProfile && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <div className="h-20 w-20 overflow-hidden rounded-full bg-brand-gradient">
              {otherProfile.avatar_url && (
                <img src={otherProfile.avatar_url} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <p className="flex items-center gap-1 text-base font-semibold">
              {otherProfile.username}
              {otherProfile.is_verified && <VerifiedBadge size={14} />}
            </p>
            <p className="mt-1 text-sm text-ink-muted">Send the first message 👋😊</p>
          </div>
        )}
        {messages.map((m, i) => {
          const mine = m.sender_id === userId;
          const grouped = reactionsFor(m.id);
          const quote = quotedContent(m.reply_to_id);
          const canShowReadReceipts = myReadReceiptsEnabled && (otherProfile?.read_receipts_enabled ?? true);
          const seen = canShowReadReceipts && !!otherLastReadAt && m.created_at <= otherLastReadAt;

          const prev = messages[i - 1];
          const next = messages[i + 1];
          const groupedWithPrev =
            !!prev && prev.sender_id === m.sender_id && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_GAP_MS;
          const isLastInGroup =
            !next || next.sender_id !== m.sender_id || new Date(next.created_at).getTime() - new Date(m.created_at).getTime() >= GROUP_GAP_MS;

          const timeLabel = formatBubbleTime(m.created_at);
          // Inline meta (time + ticks) rendered *inside* text/caption content
          // via float, so it tucks in next to the last line instead of
          // adding a new row — the classic WhatsApp trick.
          const inlineMeta = isLastInGroup ? (
            <span className={`float-right ml-2 mt-1 flex items-center gap-1 text-[10px] ${mine ? "text-white/80" : "text-ink-muted"}`}>
              {timeLabel}
              {mine && <Ticks seen={seen} />}
            </span>
          ) : null;
          // Overlay meta for media/emoji bubbles that have no wrappable text
          // flow to float into — an absolutely positioned badge instead,
          // which never changes the bubble's size.
          const overlayMeta = isLastInGroup ? (
            <span className="pointer-events-none absolute bottom-1.5 right-2 flex items-center gap-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[10px] text-white">
              {timeLabel}
              {mine && <Ticks seen={seen} light />}
            </span>
          ) : null;

          return (
            <div
              key={m.id}
              className={`flex flex-col ${mine ? "items-end" : "items-start"} ${groupedWithPrev ? "mt-0.5" : "mt-2"}`}
              onTouchStart={handleRowTouchStart}
              onTouchMove={(e) => handleRowTouchMove(m, e)}
              onTouchEnd={() => handleRowTouchEnd(m)}
            >
              <div className="relative w-full">
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 flex items-center text-ink-muted transition-opacity"
                  style={{ opacity: swipeMsgId === m.id ? Math.min(1, swipeX / SWIPE_REPLY_THRESHOLD) : 0 }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 17l-5-5 5-5M4 12h11a5 5 0 015 5v1" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div
                  className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                  style={{
                    transform: `translateX(${swipeMsgId === m.id ? swipeX : 0}px)`,
                    transition: swipeMsgId === m.id ? "none" : "transform 150ms ease-out",
                  }}
                >
              {m.media_url && isVoiceNotePath(m.media_url) ? (
                <div
                  onTouchStart={(e) => startLongPress(m, e.touches[0].clientX, e.touches[0].clientY)}
                  onTouchEnd={cancelLongPress}
                  onTouchMove={cancelLongPress}
                  onContextMenu={(e) => { e.preventDefault(); setMenu({ message: m, x: e.clientX, y: e.clientY }); }}
                >
                  <ChatVoiceNote
                    path={m.media_url}
                    mine={mine}
                    meta={
                      isLastInGroup ? (
                        <span className={`flex items-center gap-1 text-[10px] ${mine ? "text-white/80" : "text-ink-muted"}`}>
                          {timeLabel}
                          {mine && <Ticks seen={seen} />}
                        </span>
                      ) : null
                    }
                  />
                </div>
              ) : m.media_url ? (
                <div
                  onTouchStart={(e) => startLongPress(m, e.touches[0].clientX, e.touches[0].clientY)}
                  onTouchEnd={cancelLongPress}
                  onTouchMove={cancelLongPress}
                  onContextMenu={(e) => { e.preventDefault(); setMenu({ message: m, x: e.clientX, y: e.clientY }); }}
                  className="relative max-w-[65%] overflow-hidden rounded-2xl border border-black/10 dark:border-white/15"
                >
                  <ChatImage path={m.media_url} onTap={handleImageTap} />
                  {m.content ? (
                    <p
                      className={`whitespace-pre-wrap break-words px-3 py-2 text-[15px] leading-snug ${
                        mine ? "bg-brand-gradient text-white" : "bg-black/5 dark:bg-white/10"
                      }`}
                    >
                      {m.content}
                      {inlineMeta}
                    </p>
                  ) : (
                    overlayMeta
                  )}
                </div>
              ) : m.content && isSingleEmoji(m.content) && !quote ? (
                <div
                  onTouchStart={(e) => startLongPress(m, e.touches[0].clientX, e.touches[0].clientY)}
                  onTouchEnd={cancelLongPress}
                  onTouchMove={cancelLongPress}
                  onContextMenu={(e) => { e.preventDefault(); setMenu({ message: m, x: e.clientX, y: e.clientY }); }}
                  className="relative select-none px-1 py-1"
                >
                  <EmojiText text={m.content} size={44} />
                  {overlayMeta}
                </div>
              ) : (
                <div
                  onTouchStart={(e) => startLongPress(m, e.touches[0].clientX, e.touches[0].clientY)}
                  onTouchEnd={cancelLongPress}
                  onTouchMove={cancelLongPress}
                  onContextMenu={(e) => { e.preventDefault(); setMenu({ message: m, x: e.clientX, y: e.clientY }); }}
                  className={`max-w-[75%] select-none whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[15px] leading-snug ${
                    mine ? "bg-brand-gradient text-white" : "bg-black/5 dark:bg-white/10"
                  }`}
                >
                  {quote && (
                    <p className={`mb-1 truncate border-l-2 pl-2 text-xs opacity-75 ${mine ? "border-white/60" : "border-black/20 dark:border-white/30"}`}>
                      {quote}
                    </p>
                  )}
                  {m.content && <EmojiText text={m.content} size={18} />}
                  {m.edited_at && <span className="ml-1.5 text-[10px] opacity-60">(edited)</span>}
                  {inlineMeta}
                </div>
              )}
              </div>
              </div>

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
      )}

      {replyingTo && (
        <div className="flex items-center gap-2 border-t border-black/5 px-3 py-1.5 dark:border-white/5">
          <div className="min-w-0 flex-1 border-l-2 border-brand-from pl-2 text-xs text-ink-muted">
            <p className="truncate">Replying to: {previewLabel(replyingTo)}</p>
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
      {uploadingVoice && (
        <div className="border-t border-black/5 px-3 py-1.5 text-xs text-ink-muted dark:border-white/5">Sending voice note…</div>
      )}

      {!canMessage ? (
        <div className="shrink-0 border-t border-black/5 px-3 py-3 text-center text-sm text-ink-muted dark:border-white/5">
          {blocked.blockedByMe ? "You've blocked this user." : "You can't message this user."}
        </div>
      ) : (
        <div className="relative flex shrink-0 items-center gap-2 border-t border-black/5 px-2.5 py-2 dark:border-white/5">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelected} className="hidden" />

          {recordingVoice ? (
            <VoiceRecordBar onCancel={() => setRecordingVoice(false)} onSend={sendVoiceNote} />
          ) : (
            <>
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
                onClick={() => { setAttachMenuOpen(false); setRecordingVoice(true); }}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm"
              >
                🎤 Voice note
              </button>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            placeholder="Message…"
            rows={1}
            className="max-h-[120px] flex-1 resize-none rounded-2xl bg-black/5 px-3.5 py-2 text-sm leading-normal outline-none focus-visible:ring-2 focus-visible:ring-brand-from dark:bg-white/10"
          />
          {draft.trim() ? (
            <button
              onClick={sendMessage}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-gradient text-white"
              aria-label="Send message"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => setRecordingVoice(true)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/5 text-ink-muted dark:bg-white/10"
              aria-label="Record voice note"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3z" />
                <path d="M19 11a7 7 0 01-14 0M12 18v3" strokeLinecap="round" />
              </svg>
            </button>
          )}
            </>
          )}
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
                <button onClick={() => { setConfirmingDeleteMessage(menu.message); setMenu(null); }} className="w-full px-4 py-2.5 text-left text-sm text-red-500">Delete</button>
              </>
            )}
          </div>
        </div>
      )}

      {lightboxUrl && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" style={{ height: "100dvh" }} onClick={() => setLightboxUrl(null)}>
            <img src={lightboxUrl} alt="" className="max-h-[85vh] max-w-[92vw] object-contain" />
            <button onClick={() => setLightboxUrl(null)} className="absolute right-4 top-5 text-white">✕</button>
          </div>
        </Portal>
      )}

      {editingImageFile && (
        <ImageEditor
          file={editingImageFile}
          onCancel={() => setEditingImageFile(null)}
          onSend={sendEditedImage}
        />
      )}

      {confirmingDeleteMessage && (
        <ConfirmModal
          title="Delete this message?"
          confirmLabel="Delete"
          danger
          onConfirm={() => { const m = confirmingDeleteMessage; setConfirmingDeleteMessage(null); handleDelete(m); }}
          onCancel={() => setConfirmingDeleteMessage(null)}
        />
      )}
    </div>
  );
}
