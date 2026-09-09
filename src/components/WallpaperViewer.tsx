"use client";

import { useState } from "react";
import Portal from "./Portal";
import { useScrollLock } from "@/lib/useScrollLock";
import { addFavorite, removeFavorite, type WallpaperItem } from "@/lib/gallery";
import SendToChatSheet from "./SendToChatSheet";

export default function WallpaperViewer({
  wallpaper,
  isFavorite,
  onFavoriteChange,
  onClose,
}: {
  wallpaper: WallpaperItem;
  isFavorite: boolean;
  onFavoriteChange: (fav: boolean) => void;
  onClose: () => void;
}) {
  useScrollLock();
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);
  const [favBusy, setFavBusy] = useState(false);

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
        onFavoriteChange(false);
      } else {
        await addFavorite(wallpaper);
        onFavoriteChange(true);
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
          <button onClick={onClose} className="text-white" aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
          <span className="text-xs text-white/60">{wallpaper.resolution}</span>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-hidden px-2">
          <img src={wallpaper.path} alt="" className="max-h-full max-w-full object-contain" />
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
