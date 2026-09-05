"use client";

import { useEffect, useRef, useState } from "react";
import { resolveChatMediaUrl } from "@/lib/uploadChatImage";

function fmt(sec: number) {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ChatVoiceNote({ path, mine }: { path: string; mine: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    resolveChatMediaUrl(path).then((resolved) => {
      if (cancelled) return;
      if (resolved) setUrl(resolved);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  }

  if (failed) {
    return (
      <div className="flex w-56 items-center rounded-2xl bg-black/5 px-3.5 py-2.5 text-xs text-ink-muted dark:bg-white/10">
        Voice note unavailable
      </div>
    );
  }

  const progress = duration > 0 ? Math.min(1, current / duration) : 0;

  return (
    <div
      className={`flex w-56 items-center gap-2.5 rounded-2xl px-3.5 py-2.5 ${
        mine ? "bg-brand-gradient text-white" : "bg-black/5 dark:bg-white/10"
      }`}
    >
      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setCurrent(0);
          }}
          className="hidden"
        />
      )}

      <button
        onClick={toggle}
        disabled={!url}
        aria-label={playing ? "Pause" : "Play"}
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
          mine ? "bg-white/25" : "bg-black/10 dark:bg-white/15"
        }`}
      >
        {playing ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <rect x="5" y="4" width="5" height="16" />
            <rect x="14" y="4" width="5" height="16" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 4l15 8-15 8V4z" />
          </svg>
        )}
      </button>

      <div className="flex-1">
        <div className={`h-1 w-full overflow-hidden rounded-full ${mine ? "bg-white/30" : "bg-black/10 dark:bg-white/20"}`}>
          <div className={`h-full rounded-full ${mine ? "bg-white" : "bg-brand-from"}`} style={{ width: `${progress * 100}%` }} />
        </div>
        <p className={`mt-1 text-[11px] tabular-nums ${mine ? "text-white/80" : "text-ink-muted"}`}>
          {fmt(playing || current > 0 ? current : duration)}
        </p>
      </div>
    </div>
  );
}
