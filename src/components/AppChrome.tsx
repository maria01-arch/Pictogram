"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import AuthHeaderControl from "./AuthHeaderControl";
import Logo from "./Logo";
import { useBadgeCounts } from "@/lib/useBadgeCounts";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: "M3 11l9-8 9 8M5 10v10h14V10" },
  { href: "/chat", label: "Chat", icon: "M21 11.5a8.38 8.38 0 01-8.5 8.5 8.5 8.5 0 01-4-1L3 20l1-5.5A8.38 8.38 0 0112 3a8.38 8.38 0 019 8.5z" },
  { href: "/create", label: "Create", icon: "M12 5v14M5 12h14", special: true },
  { href: "/friends", label: "Friends", icon: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m5-5a4 4 0 100-8 4 4 0 000 8zm7 3a4 4 0 00-3-3.87M4 12.13A4 4 0 017 8.26" },
];

// Routes that get a plain title + notification icon instead of the
// logo + search bar (home is the only route that keeps search/logo).
const TITLED_ROUTES: { prefix: string; title: string }[] = [
  { prefix: "/chat", title: "Messages" },
  { prefix: "/friends", title: "Friends" },
  { prefix: "/create", title: "Create" },
  { prefix: "/menu", title: "Menu" },
];

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function NotificationIcon({ count }: { count: number }) {
  return (
    <Link href="/notifications" aria-label="Notifications" className="relative rounded-full p-2 text-ink-light transition hover:bg-black/5 dark:text-ink-dark dark:hover:bg-white/10">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <Badge count={count} />
    </Link>
  );
}

function SearchIcon() {
  return (
    <Link href="/search" aria-label="Search" className="rounded-full p-2 text-ink-light transition hover:bg-black/5 dark:text-ink-dark dark:hover:bg-white/10">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
      </svg>
    </Link>
  );
}

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { notifications, chats, friendRequests } = useBadgeCounts();
  const isAuthPage = pathname?.startsWith("/auth");
  const isChatThread = pathname?.startsWith("/chat/");
  const isProfilePage =
    pathname?.startsWith("/profile/") &&
    pathname !== "/profile/edit" &&
    pathname !== "/profile/account-health";
  const isSavedPage = pathname === "/saved";
  const isAdminPage = pathname === "/admin";

  // Home-feed-only "full screen" effect: the header slides up out of the
  // way on scroll-down and slides back in on scroll-up, like a lot of
  // native feed apps do, instead of staying pinned the whole time.
  const [headerHidden, setHeaderHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    lastScrollY.current = window.scrollY;
    setHeaderHidden(false);
    if (pathname !== "/") return;

    function onScroll() {
      const y = window.scrollY;
      if (y > lastScrollY.current && y > 72) setHeaderHidden(true);
      else if (y < lastScrollY.current) setHeaderHidden(false);
      lastScrollY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  if (isAuthPage || isChatThread || isProfilePage || isSavedPage || isAdminPage) {
    return <>{children}</>;
  }

  const titledRoute = TITLED_ROUTES.find((r) => pathname?.startsWith(r.prefix));
  // Menu is a drill-in hub reached via the header's hamburger icon, not a
  // primary tab destination — it shouldn't also show the bottom tab bar.
  const hideBottomNav = pathname === "/menu";

  return (
    <>
      <header
        className={`safe-top sticky top-0 z-30 glass-card transition-transform duration-300 ease-out ${
          headerHidden ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          {titledRoute ? (
            <h1 className="text-xl font-bold text-black dark:text-white">{titledRoute.title}</h1>
          ) : (
            <Logo height={26} />
          )}
          <div className="flex items-center gap-1">
            {titledRoute ? <NotificationIcon count={notifications} /> : <SearchIcon />}
            <AuthHeaderControl />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg pb-16">{children}</main>

      {!hideBottomNav && (
      <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-30 glass-card">
        <div className="mx-auto flex max-w-lg items-center justify-around py-2">
          {NAV_ITEMS.map((item) => {
            const navCount = item.href === "/chat" ? chats : item.href === "/friends" ? friendRequests : 0;
            return item.special ? (
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
                className="relative flex flex-col items-center gap-0.5 px-4 py-1 text-ink-muted transition hover:text-brand-from active:scale-95"
              >
                <span className="relative">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <Badge count={navCount} />
                </span>
                <span className="text-[11px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      )}
    </>
  );
}
