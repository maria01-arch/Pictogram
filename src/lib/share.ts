// Builds a same-origin download link. Actual byte streaming + the
// Content-Disposition header that triggers a real OS-level download (instead
// of the browser/WebView just opening the file as a page) happens in
// app/api/download/route.ts — see that file for why this can't be a direct
// client-side fetch of the R2/Supabase URL.
export function buildDownloadUrl(mediaUrl: string, filename: string): string {
  const params = new URLSearchParams({ url: mediaUrl, name: filename });
  return `/api/download?${params.toString()}`;
}

export function downloadMedia(mediaUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = buildDownloadUrl(mediaUrl, filename);
  a.download = filename; // ignored by browsers once Content-Disposition is set; harmless
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export interface ShareTarget {
  id: string;
  label: string;
  color: string;
  href: (url: string, text: string) => string;
}

// Deep links that work without any app SDK — the same approach every website's
// "share" row uses. Each opens the target's own share/composer with our link
// pre-filled; the person still presses send themselves.
export const SHARE_TARGETS: ShareTarget[] = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    color: "#25D366",
    href: (url, text) => `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
  },
  {
    id: "x",
    label: "X",
    color: "#000000",
    href: (url, text) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    id: "facebook",
    label: "Facebook",
    color: "#1877F2",
    href: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: "telegram",
    label: "Telegram",
    color: "#26A5E4",
    href: (url, text) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: "reddit",
    label: "Reddit",
    color: "#FF4500",
    href: (url, text) => `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
  },
  {
    id: "email",
    label: "Email",
    color: "#6B7280",
    href: (url, text) => `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`,
  },
];
