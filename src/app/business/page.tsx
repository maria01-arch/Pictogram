"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isNativeApp } from "@/lib/platform";
import { supabase } from "@/lib/supabaseClient";
import { getUserLocal } from "@/lib/authUser";
import { getErrorMessage } from "@/lib/errorMessage";

const STUB_ITEMS = [
  { label: "DM configuration", description: "Set up automated replies and inbox rules" },
  { label: "Apply for monetization", description: "Unlock creator payouts and brand tools" },
];

// Adds "https://" to a bare domain the person typed (e.g. "example.com")
// so the stored link always opens correctly. Leaves anything that already
// has a scheme alone.
function normalizeLink(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function BusinessProfileCard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [linkType, setLinkType] = useState<"website" | "mylinks">("website");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await getUserLocal();
      if (!user) return setLoading(false);
      setUserId(user.id);
      const { data } = await supabase
        .from("profiles")
        .select("business_email, business_link, business_link_type")
        .eq("id", user.id)
        .single();
      setEmail(data?.business_email ?? "");
      setLink(data?.business_link ?? "");
      setLinkType((data?.business_link_type as "website" | "mylinks") ?? "website");
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    if (!userId) return;
    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) {
      setError("That doesn't look like a valid email address.");
      return;
    }
    const normalizedLink = normalizeLink(link);
    setSaving(true);
    setError(null);
    setSaved(false);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        business_email: trimmedEmail || null,
        business_link: normalizedLink || null,
        business_link_type: linkType,
      })
      .eq("id", userId);
    setSaving(false);
    if (updateError) {
      setError(getErrorMessage(updateError));
      return;
    }
    setLink(normalizedLink);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) return null;

  return (
    <div className="mt-5 rounded-xl2 glass-card p-4">
      <p className="text-sm font-semibold">Business profile</p>
      <p className="mt-0.5 text-xs text-ink-muted">
        Add a contact email and link — they'll show on your profile so people can reach you or check out your work.
      </p>

      <label className="mt-4 block text-xs font-medium text-ink-muted">Business email</label>
      <input
        type="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@yourbusiness.com"
        className="mt-1.5 w-full rounded-xl2 bg-black/5 px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-from dark:bg-white/10"
      />

      <label className="mt-3 block text-xs font-medium text-ink-muted">Link</label>
      <input
        type="text"
        inputMode="url"
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="yourwebsite.com"
        className="mt-1.5 w-full rounded-xl2 bg-black/5 px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-from dark:bg-white/10"
      />

      <label className="mt-3 block text-xs font-medium text-ink-muted">Show it as</label>
      <div className="mt-1.5 flex gap-2 rounded-full bg-black/5 p-1 dark:bg-white/10">
        <button
          type="button"
          onClick={() => setLinkType("website")}
          className={`flex-1 rounded-full py-1.5 text-xs font-semibold transition ${
            linkType === "website" ? "bg-brand-gradient text-white" : "text-ink-muted"
          }`}
        >
          🌐 Website
        </button>
        <button
          type="button"
          onClick={() => setLinkType("mylinks")}
          className={`flex-1 rounded-full py-1.5 text-xs font-semibold transition ${
            linkType === "mylinks" ? "bg-brand-gradient text-white" : "text-ink-muted"
          }`}
        >
          🔗 My Links
        </button>
      </div>
      <p className="mt-1 text-[11px] text-ink-muted">
        {linkType === "website"
          ? "Shows your actual domain on your profile, e.g. \"yourbusiness.com\"."
          : "Shows a generic \"My Links\" button instead of the raw web address — handy for link-in-bio pages."}
      </p>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-4 rounded-full bg-brand-gradient px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
      </button>
    </div>
  );
}

export default function BusinessPage() {
  // The paid verification badge is hidden inside the installed app (see lib/platform.ts).
  const [inApp, setInApp] = useState(true); // start hidden to avoid a flash in the app
  useEffect(() => setInApp(isNativeApp()), []);

  return (
    <div className="px-4 pb-8 pt-4">
      <h2 className="text-lg font-bold">Business console</h2>
      <p className="mt-1 text-sm text-ink-muted">Tools for creators and businesses.</p>

      <BusinessProfileCard />

      <div className="mt-5 overflow-hidden rounded-xl2 glass-card">
        {!inApp && (
          <Link href="/business/verify" className="block px-4 py-3.5 transition hover:bg-black/5 dark:hover:bg-white/5">
            <p className="text-sm font-semibold">Get verified</p>
            <p className="mt-0.5 text-xs text-ink-muted">Apply for a verification badge</p>
          </Link>
        )}

        {STUB_ITEMS.map((item, i) => (
          <div
            key={item.label}
            className={`px-4 py-3.5 ${!inApp || i > 0 ? "border-t border-black/5 dark:border-white/5" : ""}`}
          >
            <p className="text-sm font-semibold">{item.label}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{item.description} — coming soon.</p>
          </div>
        ))}
      </div>
    </div>
  );
}
