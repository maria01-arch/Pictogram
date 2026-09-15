"use client";

import { useEffect, useRef, useState } from "react";

interface FeedVideoProps {
  videoUrl: string;
  thumbnailUrl: string | null;
  aspectRatio?: number; // width / height, defaults to 4/5
  fit?: "cover" | "contain"; // "contain" letterboxes instead of cropping
}

// Autoplays muted once at least ~65% of the video is on screen (same
// convention Instagram/TikTok use), pauses again once it scrolls mostly out
// of view. The <video> element itself still doesn't get a src until it's
// actually about to play, so scrolling past a video without lingering on it
// never starts a stream — same bandwidth-conscious principle as before,
// just triggered by visibility instead of a tap.
export default function FeedVideo({ videoUrl, thumbnailUrl, aspectRatio = 4 / 5, fit = "cover" }: FeedVideoProps) {
  const [activated, setActivated] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActivated(true); // mounts the <video src> the first time it's needed
          setPlaying(true);
        } else {
          videoRef.current?.pause();
          setPlaying(false);
        }
      },
      { threshold: 0.65 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (playing) videoRef.current?.play().catch(() => {});
  }, [playing, activated]);

  function handleTap(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation();
    setMuted((m) => !m);
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden bg-black"
      style={{ aspectRatio }}
      onClick={handleTap}
      role="button"
      tabIndex={0}
      aria-label={muted ? "Unmute video" : "Mute video"}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleTap(e)}
    >
      {/* Placeholder shown until the video has actually started playing */}
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt=""
          aria-hidden
          className={`absolute inset-0 h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"} transition-opacity duration-300 ${
            playing ? "opacity-0" : "opacity-100"
          }`}
        />
      )}

      {activated && (
        <video
          ref={videoRef}
          src={videoUrl}
          preload="none"
          playsInline
          loop
          muted={muted}
          className={`absolute inset-0 h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"}`}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
        />
      )}

      <div className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm">
        {muted ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinejoin="round" />
            <path d="M23 9l-6 6M17 9l6 6" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinejoin="round" />
            <path d="M15.5 8.5a5 5 0 010 7M19 5a10 10 0 010 14" strokeLinecap="round" />
          </svg>
        )}
      </div>
    </div>
  );
}
