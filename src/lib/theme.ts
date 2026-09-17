export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "pictogram_theme";

export function getStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

export function resolveIsDark(pref: ThemePreference): boolean {
  if (pref === "dark") return true;
  if (pref === "light") return false;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Applies the class Tailwind's darkMode:"class" strategy looks for, and
// persists the choice. This is the ONLY thing that makes any of the app's
// dark: utility classes actually take effect — until this runs, nothing
// ever adds/removes .dark on <html>, so every dark: style in the app is
// inert no matter how the device/browser is set.
export function applyTheme(pref: ThemePreference) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolveIsDark(pref));
  localStorage.setItem(STORAGE_KEY, pref);
}
