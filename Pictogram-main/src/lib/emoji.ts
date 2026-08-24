// Matches emoji clusters (including multi-codepoint sequences like ZWJ
// joins) and the trailing FE0F variation selector that many common emoji
// use (e.g. "❤️" = U+2764 + U+FE0F) — without consuming FE0F, symbols
// like heart/checkmark/etc get split into an emoji part plus a stray
// leftover character, which broke the "is this only emoji" detection.
const EMOJI_REGEX = /\p{Extended_Pictographic}\uFE0F?(?:\u200d\p{Extended_Pictographic}\uFE0F?)*/gu;

export interface TextPart {
  type: "text" | "emoji";
  value: string;
}

export function splitEmoji(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(EMOJI_REGEX)) {
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push({ type: "text", value: text.slice(lastIndex, index) });
    parts.push({ type: "emoji", value: match[0] });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) parts.push({ type: "text", value: text.slice(lastIndex) });

  return parts;
}

export function isOnlyEmoji(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const withoutEmoji = trimmed.replace(EMOJI_REGEX, "").replace(/\s/g, "");
  return withoutEmoji.length === 0;
}

// WhatsApp-style rule: exactly one emoji and nothing else renders big and
// bubble-free. Two or more emoji (or emoji mixed with text) render as
// normal bubbled text.
export function isSingleEmoji(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const parts = splitEmoji(trimmed);
  const emojiParts = parts.filter((p) => p.type === "emoji");
  const leftoverText = parts.filter((p) => p.type === "text" && p.value.trim().length > 0);
  return emojiParts.length === 1 && leftoverText.length === 0;
}
