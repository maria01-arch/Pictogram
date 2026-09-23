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
import MessageSearchSheet from "./MessageSearchSheet";
import LinkPreviewCard from "./LinkPreviewCard";
import type { MessageSearchResult } from "@/lib/messageSearch";
import EmojiText from "./EmojiText";
import { useTopLoading } from "./TopLoadingBar";
import { ChatSkeleton } from "./Skeleton";
import { isSingleEmoji } from "@/lib/emoji";
import type { Message, MessageReaction, Profile } from "@/types/database";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getUserLocal } from "@/lib/authUser";

const TYPING_TIMEOUT_MS = 2500;
const PAGE_SIZE = 40; // messages loaded at a time (older ones load as you scroll up)
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
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  // Set once a search result is opened (the loaded window is centered on
  // that message rather than the real latest messages) — lets "Jump to
  // latest" know it needs to reload the true end of the conversation
  // instead of just scrolling to the bottom of what's already in memory.
  const [hasNewer, setHasNewer] = useState(false);
  const [loadingNewer, setLoadingNewer] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [extraQuoted, setExtraQuoted] = useState<Record<string, Message>>({});
  const [sendError, setSendError] = useState<string | null>(null);
  const restoreScrollRef = useRef<{ height: number; top: number } | null>(null);
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const JUMP_THRESHOLD_PX = 200;

  function handleMessagesScroll() {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowJumpToBottom(distanceFromBottom > JUMP_THRESHOLD_PX);
    if (el.scrollTop < 120 && hasOlder && !loadingOlder) loadOlder();
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceToBottom < 120 && hasNewer && !loadingNewer) loadNewer();
  }

  // Loads the next-older page of messages when you scroll to the top.
  async function loadOlder() {
    const oldest = messages.find((m) => !m.id.startsWith("optimistic-"));
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    const el = scrollContainerRef.current;
    const { data: rows } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .lt("created_at", oldest.created_at)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);
    const older = (rows ?? []).reverse() as Message[];
    if (older.length > 0) {
      if (el) restoreScrollRef.current = { height: el.scrollHeight, top: el.scrollTop };
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id));
        return [...older.filter((m) => !known.has(m.id)), ...prev];
      });
      const { data: reacts } = await supabase
        .from("message_reactions")
        .select("*")
        .in("message_id", older.map((m) => m.id));
      if (reacts && reacts.length > 0) {
        setReactions((prev) => {
          const known = new Set(prev.map((r) => `${r.message_id}:${r.user_id}`));
          return [...prev, ...reacts.filter((r: MessageReaction) => !known.has(`${r.message_id}:${r.user_id}`))];
        });
      }
      loadMissingQuoted(older);
    }
    setHasOlder((rows ?? []).length === PAGE_SIZE);
    setLoadingOlder(false);
  }

  // Loads the next-newer page — only relevant after jumpToMessage has
  // moved the visible window away from the real end of the conversation.
  async function loadNewer() {
    const newest = messages[messages.length - 1];
    if (!newest || loadingNewer || !hasNewer) return;
    setLoadingNewer(true);
    const { data: rows } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .gt("created_at", newest.created_at)
      .order("created_at", { ascending: true })
      .limit(PAGE_SIZE);
    const newer = (rows ?? []) as Message[];
    if (newer.length > 0) {
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id));
        return [...prev, ...newer.filter((m) => !known.has(m.id))];
      });
      loadMissingQuoted(newer);
    }
    setHasNewer(newer.length === PAGE_SIZE);
    setLoadingNewer(false);
  }

  // Re-fetches the real latest page — used by "Jump to latest" after a
  // search jump, since bottomRef only points at whatever is currently
  // loaded, which may not be the actual end of the conversation anymore.
  async function reloadLatest() {
    const { data: rows } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);
    const ordered = ((rows ?? []) as Message[]).slice().reverse();
    setMessages(ordered);
    setHasOlder((rows ?? []).length === PAGE_SIZE);
    setHasNewer(false);
    loadMissingQuoted(ordered);
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  }

  // Jumps to a message found via search: loads a window of messages
  // centered on it (some before, some after), highlights it briefly, and
  // scrolls it into view. Scrolling further up/down from there uses the
  // normal loadOlder/loadNewer paging.
  async function jumpToMessage(target: MessageSearchResult) {
    setShowSearch(false);
    const [{ data: before }, { data: after }] = await Promise.all([
      supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .lte("created_at", target.created_at)
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .gt("created_at", target.created_at)
        .order("created_at", { ascending: true })
        .limit(25),
    ]);
    const merged = [...((before ?? []) as Message[]).slice().reverse(), ...((after ?? []) as Message[])];
    setMessages(merged);
    setHasOlder((before ?? []).length === 25);
    setHasNewer((after ?? []).length === 25);
    loadMissingQuoted(merged);
    setHighlightedId(target.id);
    setTimeout(() => setHighlightedId((id) => (id === target.id ? null : id)), 2000);
    requestAnimationFrame(() => {
      document.getElementById(`msg-${target.id}`)?.scrollIntoView({ block: "center" });
    });
  }

  // A reply may quote a message that isn't in the loaded page — fetch just those.
  async function loadMissingQuoted(batch: Message[]) {
    const have = new Set(batch.map((m) => m.id));
    const missing = Array.from(
      new Set(batch.map((m) => m.reply_to_id).filter((id): id is string => !!id && !have.has(id)))
    );
    if (missing.length === 0) return;
    const { data } = await supabase.from("messages").select("*").in("id", missing);
    if (data && data.length > 0) {
      setExtraQuoted((prev) => {
        const next = { ...prev };
        for (const m of data as Message[]) next[m.id] = m;
        return next;
      });
    }
  }
  function jumpToBottom() {
    if (hasNewer) {
      reloadLatest();
    } else {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }
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
    const { data: { user } } = await getUserLocal();
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
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE),
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

    // Fetched newest-first (so we only download the latest page) — show oldest-first.
    const orderedMsgs = ((msgs ?? []) as Message[]).slice().reverse();
    setMessages(orderedMsgs);
    setHasOlder((msgs ?? []).length === PAGE_SIZE);
    loadMissingQuoted(orderedMsgs);

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
      .subscribe();

    channelRef.current = channel;

    // Deliberately a SEPARATE channel from messages/typing above — read
    // receipts and online status are "nice to have instantly" but message
    // delivery is not allowed to depend on them. If this channel ever has
    // trouble, it fails on its own without taking messaging down with it.
    const metaChannel = supabase
      .channel(`conversation-meta:${conversationId}`)
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

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(metaChannel);
      if (otherTypingTimeoutRef.current) clearTimeout(otherTypingTimeoutRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }

  const hasScrolledOnceRef = useRef(false);
  const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;

  // After older messages are prepended, keep the reader exactly where they were.
  useEffect(() => {
    const restore = restoreScrollRef.current;
    const el = scrollContainerRef.current;
    if (!restore || !el) return;
    el.scrollTop = el.scrollHeight - restore.height + restore.top;
    restoreScrollRef.current = null;
  }, [messages.length]);

  useEffect(() => {
    if (!lastMessageId) return;
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
  }, [lastMessageId]);

  useEffect(() => {
    async function poll() {
      forceTick((t) => t + 1); // ages out the online dot even with no new data
      if (!otherProfile) return;

      const { data: row } = await supabase
        .from("conversation_participants")
        .select("last_read_at")
        .eq("conversation_id", conversationId)
        .eq("user_id", otherProfile.id)
        .maybeSingle();
      if (row) setOtherLastReadAt(row.last_read_at ?? null);

      const { data: profile } = await supabase
        .from("profiles")
        .select("last_seen_at, read_receipts_enabled")
        .eq("id", otherProfile.id)
        .maybeSingle();
      if (profile) setOtherProfile((prev) => (prev ? { ...prev, ...profile } : prev));
    }

    const tick = setInterval(poll, 45_000);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, otherProfile?.id]);

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
      // Don't silently swallow the message: put the text back and say so.
      setDraft(content);
      setSendError("Message couldn't be sent. Check your connection and try again.");
      setTimeout(() => setSendError(null), 5000);
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
      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: userId,
          content: caption || null,
          media_url: mediaUrl,
        })
        .select("*")
        .single();
      if (error) throw error;
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
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
      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: userId,
          content: null,
          media_url: mediaUrl,
        })
        .select("*")
        .single();
      if (error) throw error;
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
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
    const target = messages.find((m) => m.id === replyToId) ?? extraQuoted[replyToId];
    return target ? previewLabel(target) : null;
  }

  const canMessage = !blocked.blockedByMe && !blocked.blockedMe;

  return (
    <div
      className="fixed inset-x-0 flex flex-col"
      style={{ top: "var(--app-offset-top, 0px)", height: "var(--app-height, 100dvh)" }}
    >
      <header className="safe-top flex shrink-0 items-center gap-3 border-b border-black/5 px-3.5 py-3 dark:border-white/5">
        <button onClick={() => router.back()} aria-label="Back" className="shrink-0 p-1">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {otherProfile && (
          <Link href={`/profile/${otherProfile.username}`} className="flex flex-1 items-center gap-2.5 overflow-hidden">
            <div className="relative h-11 w-11 shrink-0">
              <div className="h-11 w-11 overflow-hidden rounded-full bg-brand-gradient">
                {otherProfile.avatar_url && <img src={otherProfile.avatar_url} alt="" className="h-full w-full object-cover" />}
              </div>
              {isOnline(otherProfile.last_seen_at) && (
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface-light bg-green-500 dark:border-surface-dark" />
              )}
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1 truncate text-base font-semibold">
                {otherProfile.username}
                {otherProfile.is_verified && <VerifiedBadge size={14} />}
              </p>
              {otherTyping ? (
                <p className="text-xs text-brand-from">typing…</p>
              ) : isOnline(otherProfile.last_seen_at) ? (
                <p className="text-xs text-ink-muted">Online</p>
              ) : null}
            </div>
          </Link>
        )}

        <button
          onClick={() => setShowSearch(true)}
          aria-label="Search messages"
          className="shrink-0 p-1.5"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {showSearch && (
        <MessageSearchSheet
          conversationId={conversationId}
          onSelect={jumpToMessage}
          onClose={() => setShowSearch(false)}
        />
      )}

      {initialLoading ? (
        <ChatSkeleton />
      ) : (
      <div className="relative min-h-0 flex-1">
      <div ref={scrollContainerRef} onScroll={handleMessagesScroll} className="h-full overflow-y-auto px-3 py-2.5 no-scrollbar">
        {loadingOlder && <p className="py-2 text-center text-xs text-ink-muted">Loading earlier messages…</p>}
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
          const groupedWithPrev =
            !!prev && prev.sender_id === m.sender_id && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_GAP_MS;

          const timeLabel = formatBubbleTime(m.created_at);
          // Inline meta (time + ticks) rendered *inside* text/caption content
          // via float, so it tucks in next to the last line instead of
          // adding a new row — the classic WhatsApp trick.
          const inlineMeta = (
            <span className={`float-right ml-2 mt-1 flex items-center gap-1 text-[10px] ${mine ? "text-white/80" : "text-ink-muted"}`}>
              {timeLabel}
              {mine && <Ticks seen={seen} />}
            </span>
          );
          // Overlay meta for media/emoji bubbles that have no wrappable text
          // flow to float into — an absolutely positioned badge instead,
          // which never changes the bubble's size.
          const overlayMeta = (
            <span className="pointer-events-none absolute bottom-1.5 right-2 flex items-center gap-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[10px] text-white">
              {timeLabel}
              {mine && <Ticks seen={seen} light />}
            </span>
          );

          return (
            <div
              key={m.id}
              id={`msg-${m.id}`}
              className={`flex flex-col rounded-2xl transition-colors duration-700 ${mine ? "items-end" : "items-start"} ${groupedWithPrev ? "mt-0.5" : "mt-2"} ${
                highlightedId === m.id ? "bg-brand-from/15" : ""
              }`}
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
                      <span className={`flex items-center gap-1 text-[10px] ${mine ? "text-white/80" : "text-ink-muted"}`}>
                        {timeLabel}
                        {mine && <Ticks seen={seen} />}
                      </span>
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
              {!m.media_url && m.content && <LinkPreviewCard content={m.content} mine={mine} />}
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

      {showJumpToBottom && (
        <button
          onClick={jumpToBottom}
          aria-label="Jump to latest messages"
          className="absolute bottom-3 right-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-surface-light text-ink-light shadow-lg ring-1 ring-black/10 transition active:scale-95 dark:bg-surface-dark dark:text-ink-dark dark:ring-white/10"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 4v16m0 0l-6-6m6 6l6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
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
      {sendError && (
        <div className="border-t border-black/5 px-3 py-1.5 text-xs text-red-500 dark:border-white/5">{sendError}</div>
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
        <div className="relative flex shrink-0 items-center gap-2.5 border-t border-black/5 px-3 py-2.5 dark:border-white/5">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelected} className="hidden" />

          {recordingVoice ? (
            <VoiceRecordBar onCancel={() => setRecordingVoice(false)} onSend={sendVoiceNote} />
          ) : (
            <>
          <button
            onClick={() => setAttachMenuOpen((o) => !o)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/5 text-ink-muted dark:bg-white/10"
            aria-label="Attach"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </button>

          {attachMenuOpen && (
            <div className="absolute bottom-14 left-2 z-20 w-48 overflow-hidden rounded-xl2 glass-card shadow-lg">
              <button
                onClick={() => { setAttachMenuOpen(false); fileInputRef.current?.click(); }}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-[15px]"
              >
                🖼️ Image
              </button>
              <button
                onClick={() => { setAttachMenuOpen(false); setRecordingVoice(true); }}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-[15px]"
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
            className="max-h-[120px] flex-1 resize-none rounded-2xl bg-black/5 px-4 py-2.5 text-base leading-normal outline-none focus-visible:ring-2 focus-visible:ring-brand-from dark:bg-white/10"
          />
          {draft.trim() ? (
            <button
              onClick={sendMessage}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-gradient text-white"
              aria-label="Send message"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => setRecordingVoice(true)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/5 text-ink-muted dark:bg-white/10"
              aria-label="Record voice note"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
