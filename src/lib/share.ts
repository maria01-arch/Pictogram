// Best-effort file download. Same-origin-ish CORS is needed for the R2/Supabase
// URLs we already use for post media, which serve public files with permissive
// CORS, so this works for the images/videos this app creates. If a fetch is
// blocked for any reason we fall back to just opening the file in a new tab.
export async function downloadMedia(url: string, filename: string) {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("download failed");
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
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
