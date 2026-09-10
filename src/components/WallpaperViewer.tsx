"use client";

import { useEffect, useRef, useState } from "react";
import Portal from "./Portal";
import { useScrollLock } from "@/lib/useScrollLock";
import { addFavorite, removeFavorite, type WallpaperItem } from "@/lib/gallery";
import SendToChatSheet from "./SendToChatSheet";

const SWIPE_THRESHOLD = 60;

export default function WallpaperViewer({
  items,
  startIndex,
  favoriteIds,
  onFavoriteChange,
  onClose,
}: {
  items: WallpaperItem[];
  startIndex: number;
  favoriteIds: Set<string>;
  onFavoriteChange: (item: WallpaperItem, fav: boolean) => void;
  onClose: () => void;
}) {
  useScrollLock();
  const [index, setIndex] = useState(startIndex);
  const [fullLoaded, setFullLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const touchStartY = useRef<number | null>(null);

  const wallpaper = items[index];
  const isFavorite = favoriteIds.has(wallpaper.id);

  useEffect(() => {
    setFullLoaded(false);
    setLoadFailed(false);
    setRetryKey(0);
  }, [wallpaper.id]);

  // Some full-resolution loads fail silently (no error event at all) rather
  // than firing onError — a hard timeout catches that case too, instead of
  // leaving the blurred placeholder up forever with no way out.
  useEffect(() => {
    if (fullLoaded || loadFailed) return;
    const t = setTimeout(() => setLoadFailed(true), 12000);
    return () => clearTimeout(t);
  }, [wallpaper.id, retryKey, fullLoaded, loadFailed]);

  // Make the phone's/WebView's back button close this viewer instead of
  // navigating the whole app away from the gallery. One history entry per
  // open — swiping between images doesn't touch history, only opening and
  // closing does, so back always takes exactly one press to fully exit.
  useEffect(() => {
    window.history.pushState({ pictogramModal: "wallpaper" }, "");
    const onPopState = () => onClose();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClose() {
    window.history.back(); // triggers the popstate handler above, which calls onClose
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartY.current === null) return;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;
    if (dy < -SWIPE_THRESHOLD && index < items.length - 1) setIndex((i) => i + 1);
    else if (dy > SWIPE_THRESHOLD && index > 0) setIndex((i) => i - 1);
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(wallpaper.path);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wallhaven-${wallpaper.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Likely a CORS restriction on the direct fetch — fall back to
      // opening it so the user can save it manually (long-press → save
      // image works fine once it's just an image in its own tab).
      window.open(wallpaper.path, "_blank");
    } finally {
      setDownloading(false);
    }
  }

  async function toggleFavorite() {
    setFavBusy(true);
    try {
      if (isFavorite) {
        await removeFavorite(wallpaper.id);
        onFavoriteChange(wallpaper, false);
      } else {
        await addFavorite(wallpaper);
        onFavoriteChange(wallpaper, true);
      }
    } catch {
      alert("Something went wrong. Try again.");
    } finally {
      setFavBusy(false);
    }
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex flex-col bg-black" style={{ height: "100dvh" }}>
        <div className="safe-top flex items-center justify-between px-4 py-3">
          <button onClick={handleClose} className="text-white" aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
          <span className="text-xs text-white/60">{wallpaper.resolution}</span>
        </div>

        <div
          className="relative flex flex-1 items-center justify-center overflow-hidden px-2"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Instant blurred placeholder from the grid thumbnail (already
              loaded/cached from browsing) so this never shows solid black,
              even on a slow connection — the full-res image fades in over it
              once it's actually ready. */}
          <img src={wallpaper.thumbs.large} alt="" className="absolute inset-0 h-full w-full scale-105 object-contain blur-lg" />
          <img
            key={`${wallpaper.id}-${retryKey}`}
            src={wallpaper.path}
            alt=""
            referrerPolicy="no-referrer"
            onLoad={() => setFullLoaded(true)}
            onError={() => setLoadFailed(true)}
            className={`relative max-h-full max-w-full object-contain transition-opacity duration-300 ${fullLoaded ? "opacity-100" : "opacity-0"}`}
          />
          {loadFailed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40">
              <p className="text-sm text-white/80">Couldn't load this image</p>
              <button
                onClick={() => {
                  setLoadFailed(false);
                  setFullLoaded(false);
                  setRetryKey((k) => k + 1);
                }}
                className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold text-white"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        <div className="safe-bottom flex items-center justify-around gap-2 px-4 py-4">
          <button onClick={handleDownload} disabled={downloading} className="flex flex-col items-center gap-1 text-white disabled:opacity-50">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white/15">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v13m0 0l-4-4m4 4l4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-xs">{downloading ? "Saving…" : "Download"}</span>
          </button>

          <button onClick={() => setSending(true)} className="flex flex-col items-center gap-1 text-white">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white/15">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
              </svg>
            </span>
            <span className="text-xs">Send</span>
          </button>

          <button onClick={toggleFavorite} disabled={favBusy} className="flex flex-col items-center gap-1 text-white disabled:opacity-50">
            <span className={`grid h-12 w-12 place-items-center rounded-full ${isFavorite ? "bg-red-500" : "bg-white/15"}`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                <path d="M20.8 8.6c0 4.7-8.8 10-8.8 10s-8.8-5.3-8.8-10a4.6 4.6 0 018.8-1.9A4.6 4.6 0 0120.8 8.6z" />
              </svg>
            </span>
            <span className="text-xs">Favorite</span>
          </button>
        </div>
      </div>

      {sending && <SendToChatSheet imageUrl={wallpaper.path} onClose={() => setSending(false)} />}
    </Portal>
  );
}
