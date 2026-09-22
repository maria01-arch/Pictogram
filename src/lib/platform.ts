// Is the site running inside the installed Android app (WebView / Trusted Web
// Activity / installed PWA) rather than in a normal browser tab?
// Used to hide things Google Play only allows through Play Billing
// (the paid verification badge). Set NEXT_PUBLIC_ALLOW_VERIFICATION_PAYMENTS=true
// to show them everywhere.
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_ALLOW_VERIFICATION_PAYMENTS === "true") return false;
  const ua = navigator.userAgent || "";
  if (/\bwv\b/.test(ua)) return true; // Android WebView
  if (document.referrer.startsWith("android-app://")) return true; // Trusted Web Activity launch
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true; // installed app
  return false;
}
