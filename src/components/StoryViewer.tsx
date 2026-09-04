"use client";

import { useEffect, useRef, useState } from "react";
import type { Story } from "@/types/database";
import Portal from "./Portal";
import { useScrollLock } from "@/lib/useScrollLock";

// How long a press has to be held before it counts as "hold to pause"
// instead of a tap-to-navigate. Below this, releasing navigates; at or
// above it, releasing just resumes playback in place.
const HOLD_THRESHOLD_MS = 180;

function durationFor(story: Story): number {
  return story.media_type === "video" ? 15000 : story.media_type === "text" ? 6000 : 5000;
}

export default function StoryViewer({
  stories,
  username,
  onClose,
}: {
  stories: Story[];
  username: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0); // 0-1 fill for the current segment
  const current = stories[index];
  useScrollLock();

  const videoRef = useRef<HTMLVideoElement>(null);
  // Time already spent on the current story before the most recent resume.
  const elapsedRef = useRef(0);
  // performance.now() timestamp the current running segment started at
  // (0 while paused).
  const runStartRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasHoldRef = useRef(false);

  function clearRunningTimers() {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    timerRef.current = null;
    rafRef.current = null;
  }

  function advance() {
    if (index < stories.length - 1) setIndex((i) => i + 1);
    else onClose();
  }

  function startRunning(remaining: number, duration: number) {
    runStartRef.current = performance.now();
    timerRef.current = setTimeout(advance, remaining);

    const tick = () => {
      if (!runStartRef.current) return;
      const elapsed = elapsedRef.current + (performance.now() - runStartRef.current);
      setProgress(Math.min(1, elapsed / duration));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  // Fresh story: reset and start its full countdown from zero.
  useEffect(() => {
    elapsedRef.current = 0;
    setProgress(0);
    setHolding(false);
    clearRunningTimers();
    startRunning(durationFor(current), durationFor(current));
    return clearRunningTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  function pause() {
    if (!runStartRef.current) return; // already paused
    elapsedRef.current += performance.now() - runStartRef.current;
    runStartRef.current = 0;
    clearRunningTimers();
    setHolding(true);
    videoRef.current?.pause();
  }

  function resume() {
    if (runStartRef.current) return; // already running
    setHolding(false);
    const duration = durationFor(current);
    const remaining = Math.max(0, duration - elapsedRef.current);
    startRunning(remaining, duration);
    videoRef.current?.play().catch(() => {});
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    wasHoldRef.current = false;
    // Claim the pointer so a still-held finger keeps reporting to this
    // element even if the browser would otherwise hand it off (e.g. to
    // start its own long-press gesture).
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Unsupported / already released — safe to ignore.
    }
    holdTimerRef.current = setTimeout(() => {
      wasHoldRef.current = true;
      pause();
    }, HOLD_THRESHOLD_MS);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (wasHoldRef.current) {
      resume();
      return;
    }
    const x = e.clientX;
    const half = window.innerWidth / 2;
    if (x < half) {
      if (index > 0) setIndex((i) => i - 1);
    } else {
      advance();
    }
  }

  function handlePointerCancel() {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (wasHoldRef.current) resume();
  }

  return (
    <Portal>
    <div
      className="fixed inset-0 z-50 select-none bg-black touch-none [-webkit-touch-callout:none]"
      style={{ height: "100dvh" }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerCancel}
      onPointerCancel={handlePointerCancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="absolute left-2 right-2 top-2 z-10 flex gap-1">
        {stories.map((_, i) => (
          <div key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
            <div
              className="h-full bg-white"
              style={{ width: `${(i < index ? 1 : i === index ? progress : 0) * 100}%` }}
            />
          </div>
        ))}
      </div>

      <div className="absolute left-3 top-5 z-10 flex items-center gap-2">
        <p className="text-sm font-semibold text-white">{username}</p>
        {holding && <p className="text-xs text-white/70">Paused</p>}
      </div>

      <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="absolute right-3 top-5 z-10 text-white">
        ✕
      </button>

      {current.media_type === "text" ? (
        <div className="flex h-full w-full items-center justify-center bg-brand-gradient px-8">
          <p className="text-center text-xl font-semibold leading-relaxed text-white">{current.text_content}</p>
        </div>
      ) : current.media_type === "video" ? (
        <video
          ref={videoRef}
          src={current.media_url ?? undefined}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-contain"
        />
      ) : (
        <img src={current.media_url ?? undefined} alt="" draggable={false} className="h-full w-full select-none object-contain [-webkit-touch-callout:none]" />
      )}
    </div>
    </Portal>
  );
}
