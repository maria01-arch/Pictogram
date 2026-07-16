import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

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
  title: "Pictogram — Share Life",
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body className="min-h-screen pb-16">
        <header className="sticky top-0 z-30 glass-card">
          <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
            <h1 className="bg-brand-gradient bg-clip-text text-xl font-bold text-transparent">
              pictogram
            </h1>
          </div>
        </header>

        <main className="mx-auto max-w-lg">{children}</main>

        <BottomNav />
      </body>
    </html>
  );
}

function BottomNav() {
  const items = [
    { href: "/", label: "Home", icon: "M3 11l9-8 9 8M5 10v10h14V10" },
    { href: "/chat", label: "Chat", icon: "M21 11.5a8.38 8.38 0 01-8.5 8.5 8.5 8.5 0 01-4-1L3 20l1-5.5A8.38 8.38 0 0112 3a8.38 8.38 0 019 8.5z" },
    { href: "/profile/account-health", label: "Health", icon: "M12 21s-7-4.35-9.5-8.5C.7 8.9 2.2 5 6 5c2 0 3.3 1 4 2 .7-1 2-2 4-2 3.8 0 5.3 3.9 3.5 7.5C19 16.65 12 21 12 21z" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 glass-card">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-0.5 px-4 py-1 text-ink-muted transition hover:text-brand-from active:scale-95"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[11px] font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
