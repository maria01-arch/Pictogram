"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import AuthHeaderControl from "./AuthHeaderControl";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: "M3 11l9-8 9 8M5 10v10h14V10" },
  { href: "/chat", label: "Chat", icon: "M21 11.5a8.38 8.38 0 01-8.5 8.5 8.5 8.5 0 01-4-1L3 20l1-5.5A8.38 8.38 0 0112 3a8.38 8.38 0 019 8.5z" },
  { href: "/create", label: "Create", icon: "M12 5v14M5 12h14", special: true },
  { href: "/friends", label: "Friends", icon: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m5-5a4 4 0 100-8 4 4 0 000 8zm7 3a4 4 0 00-3-3.87M4 12.13A4 4 0 017 8.26" },
];

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith("/auth");
  const isChatThread = pathname?.startsWith("/chat/");

  if (isAuthPage || isChatThread) {
    // Auth pages are a standalone experience — no app chrome around them.
    return <>{children}</>;
  }

  return (
    <>
      <header className="sticky top-0 z-30 glass-card">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <h1 className="bg-brand-gradient bg-clip-text text-xl font-bold text-transparent">
            pictogram
          </h1>
          <AuthHeaderControl />
        </div>
      </header>

      <main className="mx-auto max-w-lg pb-16">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 glass-card">
        <div className="mx-auto flex max-w-lg items-center justify-around py-2">
          {NAV_ITEMS.map((item) =>
            item.special ? (
              <Link
                key={item.href}
                href={item.href}
                className="-mt-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-white shadow-lg transition active:scale-95"
                aria-label={item.label}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ) : (
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
            )
          )}
        </div>
      </nav>
    </>
  );
}
