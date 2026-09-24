"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import AuthHeaderControl from "./AuthHeaderControl";
import { useBadgeCounts } from "@/lib/useBadgeCounts";
import { usePresenceHeartbeat } from "@/lib/usePresenceHeartbeat";
import { supabase } from "@/lib/supabaseClient";
import { getUserLocal } from "@/lib/authUser";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: "M3 11l9-8 9 8M5 10v10h14V10" },
  { href: "/chat", label: "Chat", icon: "M21 11.5a8.38 8.38 0 01-8.5 8.5 8.5 8.5 0 01-4-1L3 20l1-5.5A8.38 8.38 0 0112 3a8.38 8.38 0 019 8.5z" },
  { href: "/gallery", label: "Gallery", icon: "M4 5h16v14H4V5zm3 11l4-5 3 3 3-4 3 6H7z" },
  { href: "/friends", label: "Friends", icon: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m5-5a4 4 0 100-8 4 4 0 000 8zm7 3a4 4 0 00-3-3.87M4 12.13A4 4 0 017 8.26" },
];

// Routes that get a plain title + notification icon instead of the
// logo + search bar (home is the only route that keeps search/logo).
const TITLED_ROUTES: { prefix: string; title: string }[] = [
  { prefix: "/chat", title: "Messages" },
  { prefix: "/friends", title: "Friends" },
  { prefix: "/create", title: "Create" },
  { prefix: "/menu", title: "Menu" },
  { prefix: "/gallery", title: "Gallery" },
  { prefix: "/post", title: "Post" },
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
    <Link
      href="/search"
      aria-label="Search"
      className="rounded-full bg-black/5 p-2.5 text-black backdrop-blur-sm transition hover:bg-black/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
      </svg>
    </Link>
  );
}

function CreateIcon() {
  return (
    <Link
      href="/create"
      aria-label="Create"
      className="rounded-full bg-black/5 p-2.5 text-black backdrop-blur-sm transition hover:bg-black/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
      </svg>
    </Link>
  );
}

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { notifications, chats, friendRequests } = useBadgeCounts();
  usePresenceHeartbeat();
  const [ownProfile, setOwnProfile] = useState<{ username: string; avatar_url: string | null } | null>(null);
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await getUserLocal();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("username, avatar_url").eq("id", user.id).single();
      if (data) setOwnProfile(data);
    })();
  }, []);
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
        className={`safe-top sticky top-0 z-30 glass-header transition-transform duration-300 ease-out ${
          headerHidden ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        <div className="mx-auto flex max-w-lg items-center justify-between gap-2 px-4 py-3">
          {titledRoute ? (
            <h1 className="min-w-0 truncate text-xl font-bold text-black dark:text-white">{titledRoute.title}</h1>
          ) : (
            <span className="min-w-0 truncate bg-brand-gradient bg-clip-text text-2xl font-extrabold tracking-tight text-transparent">
              Next Social
            </span>
          )}
          <div className="flex shrink-0 items-center gap-1">
            {titledRoute ? (
              <NotificationIcon count={notifications} />
            ) : (
              <>
                <SearchIcon />
                <CreateIcon />
              </>
            )}
            <AuthHeaderControl />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg pb-16">{children}</main>

      {!hideBottomNav && (
      <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-30 glass-nav">
        <div className="mx-auto flex max-w-lg items-center justify-around py-2">
          {NAV_ITEMS.map((item) => {
            const navCount = item.href === "/chat" ? chats : item.href === "/friends" ? friendRequests : 0;
            const isActive = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                className={`relative flex items-center justify-center px-5 py-3 transition active:scale-95 ${
                  isActive ? "text-brand-from" : "text-ink-muted"
                }`}
              >
                <span className="relative flex items-center justify-center">
                  {/* Soft blue shade behind the active icon. The plate below
                      (same flat color as the nav bar) sits on top of it with
                      a little padding, so there's a visible gap between the
                      icon and the shade rather than the icon touching it. */}
                  {isActive && <span className="absolute h-11 w-11 rounded-2xl bg-brand-from/15" />}
                  <span
                    className={`relative z-10 flex items-center justify-center ${
                      isActive ? "rounded-xl bg-white p-1.5 dark:bg-black" : ""
                    }`}
                  >
                    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive ? 2.6 : 2.2}>
                      <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <Badge count={navCount} />
                </span>
              </Link>
            );
          })}

          {(() => {
            const isActive = !!ownProfile && pathname === `/profile/${ownProfile.username}`;
            return (
              <Link
                href={ownProfile ? `/profile/${ownProfile.username}` : "/menu"}
                aria-label="Profile"
                className="relative flex items-center justify-center px-5 py-3 transition active:scale-95"
              >
                <span className="relative flex items-center justify-center">
                  {isActive && <span className="absolute h-11 w-11 rounded-2xl bg-brand-from/15" />}
                  <span
                    className={`relative z-10 block h-6 w-6 overflow-hidden rounded-full bg-brand-gradient ${
                      isActive ? "ring-2 ring-brand-from ring-offset-2 ring-offset-white dark:ring-offset-black" : ""
                    }`}
                  >
                    {ownProfile?.avatar_url && <img src={ownProfile.avatar_url} alt="" className="h-full w-full object-cover" />}
                  </span>
                </span>
              </Link>
            );
          })()}
        </div>
      </nav>
      )}
    </>
  );
}
