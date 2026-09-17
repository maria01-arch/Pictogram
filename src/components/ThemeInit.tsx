"use client";

import { useEffect } from "react";
import { getStoredTheme, applyTheme } from "@/lib/theme";

export default function ThemeInit() {
  useEffect(() => {
    applyTheme(getStoredTheme());

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    function onChange() {
      if (getStoredTheme() === "system") applyTheme("system");
    }
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return null;
}
