"use client";

import { useEffect } from "react";

// Sets a --app-height CSS variable to the real, current visual viewport
// height in pixels, updated live as the on-screen keyboard opens/closes.
// This is more reliable across WebView wrappers than the CSS dvh unit,
// which some embedded/older Chromium builds don't support or handle
// inconsistently (e.g. third-party "web to app" packagers).
export function useViewportHeight() {
  useEffect(() => {
    function setHeight() {
      const height = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--app-height", `${height}px`);
    }

    setHeight();
    window.visualViewport?.addEventListener("resize", setHeight);
    window.addEventListener("resize", setHeight);

    return () => {
      window.visualViewport?.removeEventListener("resize", setHeight);
      window.removeEventListener("resize", setHeight);
    };
  }, []);
}
