"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AccountSwitcherSheet from "@/components/AccountSwitcherSheet";
import { clearAccountStash } from "@/lib/accountSwitcher";
import { getUserLocal } from "@/lib/authUser";

interface MenuItem {
  href: string;
  label: string;
  description: string;
  icon: string;
}

const SECTIONS: { title: string; items: MenuItem[] }[] = [
  {
    title: "Account",
    items: [
      {
        href: "/profile/edit",
        label: "Account management",
        description: "Profile photo, bio, location",
        icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z",
      },
      {
        href: "/profile/account-health",
        label: "Account health",
        description: "Strikes, guideline violations, appeals",
        icon: "M12 21s-7-4.35-9.5-8.5C.7 8.9 2.2 5 6 5c2 0 3.3 1 4 2 .7-1 2-2 4-2 3.8 0 5.3 3.9 3.5 7.5C19 16.65 12 21 12 21z",
      },
      {
        href: "/dating",
        label: "Dating",
        description: "Manage your dating profile",
        icon: "M20.8 8.6c0 4.7-8.8 10-8.8 10s-8.8-5.3-8.8-10a4.6 4.6 0 018.8-1.9A4.6 4.6 0 0120.8 8.6z",
      },
      {
        href: "/saved",
        label: "Saved",
        description: "Posts you've bookmarked",
        icon: "M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z",
      },
      {
        href: "/gallery",
        label: "Gallery",
        description: "Discover, download, and share wallpapers",
        icon: "M4 5h16v14H4V5zm3 11l4-5 3 3 3-4 3 6H7z",
      },
    ],
  },
  {
    title: "Creator & Business",
    items: [
      {
        href: "/business",
        label: "Business console",
        description: "DM configuration, verification, monetization",
        icon: "M4 7h16v13H4V7zM9 7V5a3 3 0 016 0v2",
      },
    ],
  },
  {
    title: "Preferences",
    items: [
      {
        href: "/settings",
        label: "Settings",
        description: "General app preferences",
        icon: "M10.3 2.5h3.4l.6 2.7 2.4 1.4 2.6-.9 1.7 3-2 1.8v2.8l2 1.8-1.7 3-2.6-.9-2.4 1.4-.6 2.7h-3.4l-.6-2.7-2.4-1.4-2.6.9-1.7-3 2-1.8v-2.8l-2-1.8 1.7-3 2.6.9 2.4-1.4z",
      },
      {
        href: "/settings/privacy",
        label: "Privacy",
        description: "Control who sees what",
        icon: "M12 2l8 4v6c0 5-3.5 8.7-8 10-4.5-1.3-8-5-8-10V6l8-4z",
      },
      {
        href: "/help",
        label: "Help",
        description: "Support and guidelines",
        icon: "M12 18h.01M9.1 9a3 3 0 115.7 1.3c-.6 1-1.8 1.4-1.8 2.7v.3",
      },
      {
        href: "/privacy-policy",
        label: "Privacy Policy",
        description: "How we handle your data",
        icon: "M9 12h6m-6 4h6M9 8h6M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z",
      },
      {
        href: "/terms",
        label: "Terms & Guidelines",
        description: "Community rules and terms of use",
        icon: "M9 12h6m-6 4h6M9 8h6M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z",
      },
    ],
  },
];

export default function MenuPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<{ username: string; avatar_url: string | null; display_name: string | null } | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  useEffect(() => {
    getUserLocal().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("username, avatar_url, display_name").eq("id", user.id).single();
      setProfile(data);
    });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    clearAccountStash();
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <div className="px-4 pb-10 pt-4">
      <h2 className="text-lg font-bold">Menu</h2>

      {profile ? (
        <Link
          href={`/profile/${profile.username}`}
          className="mt-4 flex items-center gap-4 rounded-xl2 glass-card p-4 transition hover:bg-black/5 dark:hover:bg-white/5"
        >
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-brand-gradient">
            {profile.avatar_url && <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold">{profile.display_name || profile.username}</p>
            <p className="text-sm text-ink-muted">@{profile.username} · View your profile</p>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-ink-muted">
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      ) : (
        <div className="mt-4 flex items-center gap-4 rounded-xl2 glass-card p-4">
          <div className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-black/10 dark:bg-white/10" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-black/10 dark:bg-white/10" />
            <div className="h-3 w-44 animate-pulse rounded bg-black/10 dark:bg-white/10" />
          </div>
        </div>
      )}

      {profile && (
        <button
          onClick={() => setSwitcherOpen(true)}
          className="mt-2 flex w-full items-center gap-3 rounded-xl2 glass-card px-4 py-3 text-left transition hover:bg-black/5 dark:hover:bg-white/5"
        >
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/[0.04] dark:bg-white/[0.06]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-ink-light/80 dark:text-ink-dark/80">
              <path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="flex-1 text-[15px] font-bold">Switch account</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-ink-muted/60">
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {SECTIONS.map((section) => (
        <div key={section.title} className="mt-5">
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {section.title}
          </h3>
          <div className="overflow-hidden rounded-xl2 glass-card">
            {section.items.map((item, i) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3.5 px-4 py-3 transition active:bg-black/5 dark:active:bg-white/5 ${
                  i !== 0 ? "border-t border-black/5 dark:border-white/5" : ""
                }`}
              >
                {/* A calm, uniform neutral chip reads as one coherent list —
                    the old bare brand-gradient icon repeated on every row is
                    what made the menu feel like a toy palette. */}
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/[0.04] dark:bg-white/[0.06]">
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    className="text-ink-light/80 dark:text-ink-dark/80"
                  >
                    <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold">{item.label}</p>
                  <p className="truncate text-xs font-medium text-ink-muted">{item.description}</p>
                </div>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-ink-muted/60">
                  <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={handleLogout}
        className="mt-6 w-full rounded-xl2 border border-red-500/20 bg-red-500/[0.06] py-3 text-[15px] font-bold text-red-500 transition active:bg-red-500/10"
      >
        Log out
      </button>

      {switcherOpen && <AccountSwitcherSheet onClose={() => setSwitcherOpen(false)} />}
    </div>
  );
}
