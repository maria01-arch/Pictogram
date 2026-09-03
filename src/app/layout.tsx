import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import AppChrome from "@/components/AppChrome";
import { TopLoadingProvider } from "@/components/TopLoadingBar";
import OneSignalInit from "@/components/OneSignalInit";
import RealtimeNotificationListener from "@/components/RealtimeNotificationListener";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["500", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Next Social — Share Life",
  description: "A creator-first social platform. No shadowbans, no bloat.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F9FC" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0F19" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // viewportFit: "cover" lets content extend under the status bar/notch —
  // required for the transparent status bar in the webtoapp wrapper.
  // Without it, safe-area-inset-* below always evaluates to 0.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body className="min-h-screen">
        <OneSignalInit />
        <RealtimeNotificationListener />
        <TopLoadingProvider>
          <AppChrome>{children}</AppChrome>
        </TopLoadingProvider>
      </body>
    </html>
  );
}
