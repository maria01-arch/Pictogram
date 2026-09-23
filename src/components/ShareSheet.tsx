"use client";

import { useState } from "react";
import Portal from "./Portal";
import { useScrollLock } from "@/lib/useScrollLock";
import { SHARE_TARGETS, downloadMedia } from "@/lib/share";

// Simple, recognizable glyphs for each destination — replaces the old
// "first letter in a circle" placeholders. Drawn as plain white paths on the
// brand-colored circle from SHARE_TARGETS, not traced logo artwork.
function ShareIcon({ id }: { id: string }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "white" } as const;
  switch (id) {
    case "whatsapp":
      return (
        <svg {...common}>
          <path d="M12 2.2c-5.4 0-9.8 4.4-9.8 9.8 0 1.7.5 3.4 1.3 4.9L2 22l5.2-1.4a9.8 9.8 0 004.8 1.2c5.4 0 9.8-4.4 9.8-9.8s-4.4-9.8-9.8-9.8zm0 17.8c-1.5 0-3-.4-4.3-1.2l-.3-.2-3.1.8.8-3-.2-.3a8 8 0 1114.7-4.5c0 4.4-3.6 8-8 8h.4z" />
          <path d="M9.1 7.4c-.2-.5-.4-.5-.7-.5h-.5c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.7s1.2 3.2 1.4 3.4c.2.2 2.3 3.6 5.7 4.9 2.8 1.1 3.4.9 4 .8.6-.1 1.9-.8 2.2-1.5.3-.7.3-1.4.2-1.5-.1-.1-.3-.2-.6-.4-.3-.2-1.9-1-2.2-1.1-.3-.1-.5-.1-.7.1-.2.3-.8 1-1 1.2-.2.2-.4.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.6-1.6-.9-2.2z" />
        </svg>
      );
    case "x":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4">
          <path d="M5 5l14 14M19 5L5 19" strokeLinecap="round" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...common}>
          <path d="M14.5 8.5H16V6h-1.8c-2 0-3.4 1.3-3.4 3.5V11H9v2.5h1.8V21h2.5v-7.5h2l.4-2.5h-2.4v-1.2c0-.7.3-1.3 1.2-1.3z" />
        </svg>
      );
    case "telegram":
      return (
        <svg {...common}>
          <path d="M21 3.5L2.5 10.9c-.9.4-.9 1.7.1 2l4.5 1.5 1.7 5.3c.2.7 1.1.9 1.6.4l2.5-2.4 4.5 3.4c.7.5 1.7.1 1.9-.7l3-16.4c.2-1-.8-1.8-1.7-1.5zM8.6 14.6l-2-1.6 9.7-6.9c.2-.1.4.1.2.3l-7.9 8.2z" />
        </svg>
      );
    case "reddit":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="14" rx="8" ry="6" />
          <circle cx="12" cy="6.5" r="1.6" fill="white" />
          <path d="M12 5v1.5" stroke="white" strokeWidth="1.4" />
          <circle cx="9" cy="13.5" r="1.3" fill="#FF4500" />
          <circle cx="15" cy="13.5" r="1.3" fill="#FF4500" />
          <path d="M9 16.5c1 .8 5 .8 6 0" stroke="#FF4500" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </svg>
      );
    case "email":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
          <rect x="3.5" y="5.5" width="17" height="13" rx="1.8" />
          <path d="M4.5 7l7.5 6 7.5-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

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

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(onClose, 700);
  }

  function handleDownload() {
    if (!mediaUrl) return;
    const ext = mediaType === "video" ? "mp4" : "jpg";
    // Triggering the browser/OS's own download handling is instantaneous —
    // no fetch/blob step needed on our side (see app/api/download).
    downloadMedia(mediaUrl, `post.${ext}`);
    setTimeout(onClose, 400);
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
                  className="grid h-12 w-12 place-items-center rounded-full"
                  style={{ backgroundColor: t.color }}
                >
                  <ShareIcon id={t.id} />
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
                className="flex w-full items-center gap-3 border-t border-black/5 px-4 py-3 text-left text-sm font-semibold dark:border-white/5"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {`Download ${mediaType === "video" ? "video" : "image"}`}
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
