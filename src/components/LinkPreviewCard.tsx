"use client";

import { useEffect, useState } from "react";
import { extractFirstUrl, fetchLinkPreview, type LinkPreview } from "@/lib/linkPreview";

// Shown under a text message that contains a link — pulled in below the
// bubble it belongs to (see ChatThreadView), not inside it, so a failed or
// data-less preview can disappear without leaving an odd gap in the bubble.
export default function LinkPreviewCard({ content, mine }: { content: string; mine?: boolean }) {
  const url = extractFirstUrl(content);
  const [preview, setPreview] = useState<LinkPreview | null | undefined>(undefined);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setPreview(undefined);
    fetchLinkPreview(url).then((p) => {
      if (!cancelled) setPreview(p);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!url) return null;
  if (preview === null) return null; // fetched — no usable title/image found

  if (preview === undefined) {
    return (
      <div className="mt-1.5 h-14 w-full max-w-[75%] animate-pulse rounded-xl2 bg-black/5 dark:bg-white/10" />
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`mt-1.5 flex max-w-[75%] items-center gap-2.5 overflow-hidden rounded-xl2 border p-2 ${
        mine
          ? "border-white/20 bg-white/10"
          : "border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/10"
      }`}
    >
      {preview.image && (
        <img src={preview.image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
      )}
      <div className="min-w-0 flex-1">
        {preview.title && <p className="truncate text-xs font-semibold">{preview.title}</p>}
        <p className="truncate text-[11px] text-ink-muted">{preview.domain}</p>
      </div>
    </a>
  );
}
