"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { checkIsAdmin } from "../lib/admin";
import { getStoredTheme, applyTheme, type ThemePreference } from "@/lib/theme";
import { getUserLocal } from "@/lib/authUser";
import { clearAccountStash } from "@/lib/accountSwitcher";
import Portal from "./Portal";
import { useScrollLock } from "@/lib/useScrollLock";

// Type-your-username confirmation, then the server permanently deletes the
// account, posts, stories, chats and files (see /api/account/delete).
function DeleteAccountModal({ username, onClose }: { username: string; onClose: () => void }) {
  useScrollLock();
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim().toLowerCase() === username.toLowerCase();

  async function confirmDelete() {
    if (!matches || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: typed.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not delete the account. Please try again.");

      // The login no longer exists — clear everything stored on this device.
      await supabase.auth.signOut().catch(() => {});
      clearAccountStash();
      window.location.href = "/auth/login";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setDeleting(false);
    }
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center" onClick={deleting ? undefined : onClose}>
        <div
          className="safe-bottom w-full max-w-sm rounded-t-2xl glass-card p-5 shadow-lg sm:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-base font-bold text-red-500">Delete your account?</h3>
          <p className="mt-2 text-sm text-ink-muted">
            This permanently deletes your profile, posts, stories, comments, messages, matches and uploaded files. It
            can't be undone.
          </p>
          <label className="mt-4 block text-xs font-medium text-ink-muted">
            Type <span className="font-bold text-ink-light dark:text-ink-dark">{username}</span> to confirm
          </label>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            className="mt-1.5 w-full rounded-xl2 bg-black/5 px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:bg-white/10"
          />
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
          <div className="mt-5 flex gap-3">
            <button
              onClick={onClose}
              disabled={deleting}
              className="flex-1 rounded-full bg-black/5 py-2.5 text-sm font-semibold disabled:opacity-40 dark:bg-white/10"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              disabled={!matches || deleting}
              className="flex-1 rounded-full bg-red-500 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {deleting ? "Deleting…" : "Delete forever"}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

export default function SettingsView() {
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [readReceipts, setReadReceipts] = useState(true);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [username, setUsername] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  function handleThemeChange(pref: ThemePreference) {
    setTheme(pref);
    applyTheme(pref);
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await getUserLocal();
      if (!user) return setLoading(false);
      setUserId(user.id);

      const { data } = await supabase.from("profiles").select("username, requires_follow_approval, read_receipts_enabled").eq("id", user.id).single();
      setUsername(data?.username ?? "");
      setRequiresApproval(!!data?.requires_follow_approval);
      setReadReceipts(data?.read_receipts_enabled ?? true);
      setLoading(false);

      // Silent — this only ever resolves true for the one granted account.
      // Everyone else's settings page renders with no trace of this section.
      checkIsAdmin().then(setIsAdmin);
    }
    load();
  }, []);

  async function toggle() {
    if (!userId) return;
    const next = !requiresApproval;
    setRequiresApproval(next);
    await supabase.from("profiles").update({ requires_follow_approval: next }).eq("id", userId);
  }

  async function toggleReadReceipts() {
    if (!userId) return;
    const next = !readReceipts;
    setReadReceipts(next);
    await supabase.from("profiles").update({ read_receipts_enabled: next }).eq("id", userId);
  }

  if (loading) return <p className="px-4 py-16 text-center text-sm text-ink-muted">Loading…</p>;

  return (
    <div className="px-4 pb-8 pt-4">
      <h2 className="text-lg font-bold">Settings</h2>

      <div className="mt-5 rounded-xl2 glass-card px-4 py-3.5">
        <p className="text-sm font-semibold">Appearance</p>
        <div className="mt-3 flex gap-2 rounded-full bg-black/5 p-1 dark:bg-white/10">
          {(["light", "dark", "system"] as const).map((t) => (
            <button
              key={t}
              onClick={() => handleThemeChange(t)}
              className={`flex-1 rounded-full py-1.5 text-xs font-semibold capitalize transition ${
                theme === t ? "bg-brand-gradient text-white" : "text-ink-muted"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl2 glass-card px-4 py-3.5">
        <div>
          <p className="text-sm font-semibold">Approve new followers</p>
          <p className="mt-0.5 text-xs text-ink-muted">Review requests before someone can follow you</p>
        </div>
        <button
          onClick={toggle}
          className={`h-6 w-11 shrink-0 rounded-full transition ${requiresApproval ? "bg-brand-gradient" : "bg-black/15 dark:bg-white/15"}`}
        >
          <span className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white transition-transform ${requiresApproval ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl2 glass-card px-4 py-3.5">
        <div>
          <p className="text-sm font-semibold">Read receipts</p>
          <p className="mt-0.5 text-xs text-ink-muted">Let people see when you've read their messages</p>
        </div>
        <button
          onClick={toggleReadReceipts}
          className={`h-6 w-11 shrink-0 rounded-full transition ${readReceipts ? "bg-brand-gradient" : "bg-black/15 dark:bg-white/15"}`}
        >
          <span className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white transition-transform ${readReceipts ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl2 glass-card">
        <Link href="/privacy-policy" className="flex items-center justify-between px-4 py-3.5 text-sm font-semibold">
          Privacy Policy <span className="text-ink-muted">›</span>
        </Link>
        <Link href="/terms" className="flex items-center justify-between border-t border-black/5 px-4 py-3.5 text-sm font-semibold dark:border-white/5">
          Terms &amp; Community Guidelines <span className="text-ink-muted">›</span>
        </Link>
      </div>

      {isAdmin && (
        <Link
          href="/admin"
          className="mt-3 flex items-center justify-between rounded-xl2 glass-card px-4 py-3.5"
        >
          <p className="text-sm font-semibold">Admin panel</p>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      )}

      <div className="mt-8 rounded-xl2 border border-red-500/30 p-4">
        <p className="text-sm font-semibold text-red-500">Delete account</p>
        <p className="mt-1 text-xs text-ink-muted">
          Permanently delete your account and all of your data.
        </p>
        <button
          onClick={() => setDeleteOpen(true)}
          disabled={!username}
          className="mt-3 rounded-full bg-red-500 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          Delete my account
        </button>
      </div>

      {deleteOpen && <DeleteAccountModal username={username} onClose={() => setDeleteOpen(false)} />}
    </div>
  );
}
