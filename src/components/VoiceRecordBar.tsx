"use client";

import { useEffect, useRef, useState } from "react";
import { pickVoiceMimeType } from "@/lib/uploadChatVoice";

export default function VoiceRecordBar({
  onCancel,
  onSend,
}: {
  onCancel: () => void;
  onSend: (blob: Blob, mimeType: string) => void;
}) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingActionRef = useRef<"send" | "cancel" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const mimeType = pickVoiceMimeType();
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          streamRef.current?.getTracks().forEach((t) => t.stop());
          if (pendingActionRef.current === "send" && chunksRef.current.length) {
            const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
            onSend(blob, mimeType || "audio/webm");
          } else {
            onCancel();
          }
        };

        startRef.current = Date.now();
        recorder.start();
        timerRef.current = setInterval(() => setElapsedMs(Date.now() - startRef.current), 200);
      } catch {
        // Most likely: mic permission denied, no mic present, or (for the
        // wrapped Android app) the WebView never granted RECORD_AUDIO to
        // getUserMedia in the first place.
        setError("Couldn't access the microphone.");
      }
    })();

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish(action: "send" | "cancel") {
    if (timerRef.current) clearInterval(timerRef.current);
    pendingActionRef.current = action;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop(); // onstop carries out the actual send/cancel
    } else {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (action === "cancel") onCancel();
    }
  }

  function fmt(ms: number) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-between gap-2 rounded-2xl bg-red-500/10 px-3.5 py-2 text-sm text-red-500">
        <span>{error}</span>
        <button onClick={onCancel} className="font-semibold">
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center gap-3 rounded-2xl bg-black/5 px-3.5 py-2 dark:bg-white/10">
      <button onClick={() => finish("cancel")} aria-label="Cancel recording" className="text-lg text-red-500">
        🗑
      </button>
      <span className="flex items-center gap-2 text-sm tabular-nums">
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
        {fmt(elapsedMs)}
      </span>
      <span className="flex-1 text-xs text-ink-muted">Recording…</span>
      <button
        onClick={() => finish("send")}
        aria-label="Send voice note"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-gradient text-white"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
        </svg>
      </button>
    </div>
  );
}
