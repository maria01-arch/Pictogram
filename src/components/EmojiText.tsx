"use client";

import { splitEmoji, twemojiUrl } from "@/lib/emoji";

// Renders emoji using twemoji images (consistent look across devices,
// like WhatsApp) instead of relying on the OS's native emoji font, while
// leaving surrounding text untouched.
export default function EmojiText({ text, size = 18 }: { text: string; size?: number }) {
  const parts = splitEmoji(text);

  return (
    <>
      {parts.map((part, i) =>
        part.type === "emoji" ? (
          <img
            key={i}
            src={twemojiUrl(part.value)}
            alt={part.value}
            draggable={false}
            style={{ width: size, height: size, display: "inline-block", verticalAlign: "-4px", margin: "0 1px" }}
            onError={(e) => {
              // Fall back to the native glyph if this exact sequence isn't in twemoji's set.
              const span = document.createElement("span");
              span.textContent = part.value;
              e.currentTarget.replaceWith(span);
            }}
          />
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </>
  );
}
