"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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
    ],
  },
];

export default function MenuPage() {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <div className="px-4 pb-10 pt-4">
      <h2 className="text-lg font-bold">Menu</h2>

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
                className={`flex items-center gap-3 px-4 py-3.5 transition hover:bg-black/5 dark:hover:bg-white/5 ${
                  i !== 0 ? "border-t border-black/5 dark:border-white/5" : ""
                }`}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  className="shrink-0 text-brand-from"
                >
                  <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="truncate text-xs text-ink-muted">{item.description}</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-ink-muted">
                  <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={handleLogout}
        className="mt-6 w-full rounded-xl2 bg-red-500/10 py-3 text-sm font-semibold text-red-500"
      >
        Log out
      </button>
    </div>
  );
}
