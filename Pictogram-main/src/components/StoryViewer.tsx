"use client";

import { useEffect, useState } from "react";
import type { Story } from "@/types/database";

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
  const current = stories[index];

  useEffect(() => {
    const duration = current.media_type === "video" ? 15000 : current.media_type === "text" ? 6000 : 5000;
    const timer = setTimeout(() => {
      if (index < stories.length - 1) setIndex((i) => i + 1);
      else onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [index, current, stories.length, onClose]);

  function handleTap(e: React.MouseEvent<HTMLDivElement>) {
    const x = e.clientX;
    const half = window.innerWidth / 2;
    if (x < half) {
      if (index > 0) setIndex((i) => i - 1);
    } else {
      if (index < stories.length - 1) setIndex((i) => i + 1);
      else onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black" onClick={handleTap}>
      <div className="absolute left-2 right-2 top-2 z-10 flex gap-1">
        {stories.map((_, i) => (
          <div key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
            <div className={`h-full bg-white ${i < index ? "w-full" : i === index ? "w-full animate-pulse" : "w-0"}`} />
          </div>
        ))}
      </div>

      <div className="absolute left-3 top-5 z-10 flex items-center gap-2">
        <p className="text-sm font-semibold text-white">{username}</p>
      </div>

      <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="absolute right-3 top-5 z-10 text-white">
        ✕
      </button>

      {current.media_type === "text" ? (
        <div className="flex h-full w-full items-center justify-center bg-brand-gradient px-8">
          <p className="text-center text-xl font-semibold leading-relaxed text-white">{current.text_content}</p>
        </div>
      ) : current.media_type === "video" ? (
        <video src={current.media_url ?? undefined} autoPlay playsInline muted className="h-full w-full object-contain" />
      ) : (
        <img src={current.media_url ?? undefined} alt="" className="h-full w-full object-contain" />
      )}
    </div>
  );
}
