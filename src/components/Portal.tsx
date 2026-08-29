"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Any fixed-position overlay (comments sheet, confirm modal, lightbox)
// nested inside a card that has backdrop-blur/transform on it can get
// trapped by that ancestor instead of covering the real screen — WebView
// wrappers (webtoapp-style app shells) are especially prone to this.
// Rendering straight into document.body sidesteps the whole problem.
export default function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
