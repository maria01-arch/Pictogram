"use client";

import { useState } from "react";
import Portal from "./Portal";
import { useScrollLock } from "@/lib/useScrollLock";
import { SHARE_TARGETS, downloadMedia } from "@/lib/share";

export default function ShareSheet({
  url,
  text,
  mediaUrl,
  mediaType,
  disableDownload,
  onClose,
}: {
  url: string;
  text: string;
  mediaUrl?: string | null;
  mediaType?: "image" | "video" | "text" | "carousel";
  disableDownload?: boolean;
  onClose: () => void;
}) {
  useScrollLock();
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(onClose, 700);
  }

  async function handleDownload() {
    if (!mediaUrl || downloading) return;
    setDownloading(true);
    const ext = mediaType === "video" ? "mp4" : "jpg";
    await downloadMedia(mediaUrl, `post.${ext}`);
    setDownloading(false);
  }

  const canDownload = mediaUrl && mediaType !== "text" && mediaType !== "carousel" && !disableDownload;

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={onClose}>
        <div
          className="safe-bottom w-full max-w-lg rounded-t-2xl glass-card p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-base font-bold">Share</p>

          <div className="mt-4 flex gap-4 overflow-x-auto pb-1 no-scrollbar">
            {SHARE_TARGETS.map((t) => (
              <a
                key={t.id}
                href={t.href(url, text)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="flex shrink-0 flex-col items-center gap-1.5"
              >
                <span
                  className="grid h-12 w-12 place-items-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: t.color }}
                >
                  {t.label[0]}
                </span>
                <span className="text-[11px] text-ink-muted">{t.label}</span>
              </a>
            ))}
          </div>

          <div className="mt-4 overflow-hidden rounded-xl2 bg-black/5 dark:bg-white/10">
            <button onClick={copyLink} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M10 13a5 5 0 007.5.5l2-2a5 5 0 00-7-7l-1.5 1.5M14 11a5 5 0 00-7.5-.5l-2 2a5 5 0 007 7l1.5-1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {copied ? "Link copied!" : "Copy link"}
            </button>

            {canDownload && (
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex w-full items-center gap-3 border-t border-black/5 px-4 py-3 text-left text-sm font-semibold disabled:opacity-50 dark:border-white/5"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {downloading ? "Downloading…" : `Download ${mediaType === "video" ? "video" : "image"}`}
              </button>
            )}

            {!canDownload && mediaUrl && mediaType !== "text" && mediaType !== "carousel" && (
              <p className="border-t border-black/5 px-4 py-3 text-xs text-ink-muted dark:border-white/5">
                The creator has turned off downloading for this post.
              </p>
            )}
          </div>

          <button onClick={onClose} className="mt-3 w-full py-2 text-sm font-medium text-ink-muted">
            Cancel
          </button>
        </div>
      </div>
    </Portal>
  );
}
