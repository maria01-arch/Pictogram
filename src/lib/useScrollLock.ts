"use client";

import { useEffect } from "react";

// Without this, overscrolling inside a fixed-position overlay (comments
// sheet, media lightbox) can "leak" past the end of its own scrollable
// area and scroll the page behind it — the classic scroll-through bug.
// Locking the body's own scroll while the overlay is mounted, and
// restoring whatever it was before on unmount, fixes it regardless of
// how the overlay itself scrolls internally.
export function useScrollLock() {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, []);
}
