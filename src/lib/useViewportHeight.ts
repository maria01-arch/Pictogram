"use client";

import { useEffect } from "react";

// Sets --app-height (visual viewport height) and --app-offset-top CSS
// variables, updated live as the on-screen keyboard opens/closes. This is
// more reliable across WebView wrappers than the CSS dvh unit, which some
// embedded/older Chromium builds don't support or handle inconsistently
// (e.g. third-party "web to app" packagers).
//
// --app-offset-top matters because some mobile browsers respond to the
// keyboard by SCROLLING the layout viewport (to keep the focused input in
// view) rather than resizing it — visualViewport.height stays the same but
// visualViewport.offsetTop becomes nonzero. A container sized by height
// alone but left in normal document flow can drift away from the actual
// visible area in that case, which is what caused the compose bar to
// sometimes float mid-screen instead of sitting above the keyboard.
export function useViewportHeight() {
  useEffect(() => {
    function setHeight() {
      const vv = window.visualViewport;
      const height = vv?.height ?? window.innerHeight;
      const offsetTop = vv?.offsetTop ?? 0;
      document.documentElement.style.setProperty("--app-height", `${height}px`);
      document.documentElement.style.setProperty("--app-offset-top", `${offsetTop}px`);
    }

    setHeight();
    window.visualViewport?.addEventListener("resize", setHeight);
    window.visualViewport?.addEventListener("scroll", setHeight);
    window.addEventListener("resize", setHeight);

    return () => {
      window.visualViewport?.removeEventListener("resize", setHeight);
      window.visualViewport?.removeEventListener("scroll", setHeight);
      window.removeEventListener("resize", setHeight);
    };
  }, []);
}
