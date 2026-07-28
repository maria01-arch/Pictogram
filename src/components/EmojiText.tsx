"use client";

import { splitEmoji } from "@/lib/emoji";

// Renders emoji at a controlled size using the device's native emoji font
// (no external image CDN — that's fragile, since ad-blockers/privacy
// browsers like Brave Shields can silently block the requests, losing
// the sizing when the fallback kicks in). Native rendering always works.
export default function EmojiText({ text, size = 18 }: { text: string; size?: number }) {
  const parts = splitEmoji(text);

  return (
    <>
      {parts.map((part, i) =>
        part.type === "emoji" ? (
          <span key={i} style={{ fontSize: size, lineHeight: 1, verticalAlign: "-15%" }}>
            {part.value}
          </span>
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </>
  );
}
