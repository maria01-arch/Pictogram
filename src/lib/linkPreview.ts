// In-memory only — link previews are a rendering nicety, not data worth
// persisting client-side. The real cache (shared across everyone, so the
// same link is only ever fetched once) lives server-side in the
// link_preview_cache table, hit by app/api/link-preview.
const cache = new Map<string, LinkPreview | null>();

export interface LinkPreview {
  title: string | null;
  description: string | null;
  image: string | null;
  domain: string;
}

// First http(s) URL in a message, with trailing punctuation that's almost
// always part of the sentence rather than the URL (a period ending the
// message, a comma, a closing bracket someone typed around it) trimmed off.
export function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return null;
  return match[0].replace(/[.,!?;:)\]}]+$/, "");
}

export async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  if (cache.has(url)) return cache.get(url) ?? null;
  try {
    const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
    if (!res.ok) {
      cache.set(url, null);
      return null;
    }
    const data = (await res.json()) as LinkPreview;
    const preview = data.title || data.image ? data : null;
    cache.set(url, preview);
    return preview;
  } catch {
    cache.set(url, null);
    return null;
  }
}
