// Matches emoji clusters (including multi-codepoint sequences like flags,
// skin-tone modifiers, and ZWJ-joined emoji) using the Unicode
// Extended_Pictographic property, supported in modern JS engines.
const EMOJI_REGEX = /(?:\p{Extended_Pictographic}(?:\u200d\p{Extended_Pictographic})*)/gu;

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

// twemoji's CDN filename convention: lowercase hex codepoints joined by
// hyphens, with the FE0F variation selector stripped (matches how most
// of its asset filenames are generated).
export function twemojiUrl(emoji: string): string {
  const codepoints = Array.from(emoji)
    .map((c) => c.codePointAt(0)!.toString(16))
    .filter((cp) => cp !== "fe0f")
    .join("-");
  return `https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/${codepoints}.png`;
}
