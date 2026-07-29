"use client";

import { useRef, useState } from "react";
import type { PostMedia } from "@/types/database";

export default function PostCarousel({ items, aspectRatio }: { items: PostMedia[]; aspectRatio: number }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIndex(index);
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory overflow-x-auto no-scrollbar"
        style={{ aspectRatio }}
      >
        {items.map((item) => (
          <img
            key={item.id}
            src={item.media_url}
            alt=""
            className="w-full shrink-0 snap-center object-cover"
            style={{ aspectRatio }}
          />
        ))}
      </div>

      {items.length > 1 && (
        <>
          <div className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white">
            {activeIndex + 1}/{items.length}
          </div>
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
            {items.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition ${i === activeIndex ? "bg-white" : "bg-white/40"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
