"use client";

import { useEffect, useRef, useState } from "react";
import Portal from "./Portal";
import { useScrollLock } from "@/lib/useScrollLock";

// Deliberately much simpler than ImageEditor (no draw/crop/rotate tools) —
// just a preview, a caption, and a heads-up if the clip will be trimmed.
export default function VideoPreview({
  file,
  maxDurationSeconds,
  onCancel,
  onSend,
}: {
  file: File;
  maxDurationSeconds: number;
  onCancel: () => void;
  onSend: (result: { file: File; caption: string }) => void;
}) {
  useScrollLock();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [url] = useState(() => URL.createObjectURL(file));
  const [duration, setDuration] = useState<number | null>(null);
  const [caption, setCaption] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    return () => URL.revokeObjectURL(url);
  }, [url]);

  const willTrim = duration !== null && duration > maxDurationSeconds + 0.5;

  function handleSend() {
    if (sending) return;
    setSending(true);
    onSend({ file, caption: caption.trim() });
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex flex-col bg-black">
        <div className="safe-top flex shrink-0 items-center justify-between px-3 py-3">
          <button onClick={onCancel} aria-label="Cancel" className="p-1.5 text-white">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
          {willTrim && (
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
              Will be trimmed to {maxDurationSeconds}s
            </span>
          )}
        </div>

        <div className="flex flex-1 items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            src={url}
            controls
            playsInline
            className="max-h-full max-w-full"
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          />
        </div>

        <div className="safe-bottom shrink-0 px-3 pb-3 pt-2">
          {!willTrim && duration !== null && maxDurationSeconds < 60 && (
            <p className="mb-2 px-1 text-center text-xs text-white/60">
              Unverified accounts can send up to {maxDurationSeconds}s clips — get verified for up to 60s.
            </p>
          )}
          <div className="flex items-center gap-2.5">
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption…"
              className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/50 outline-none"
            />
            <button
              onClick={handleSend}
              disabled={sending}
              aria-label="Send video"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-gradient text-white disabled:opacity-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
