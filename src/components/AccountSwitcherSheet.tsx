"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Portal from "./Portal";
import { useScrollLock } from "@/lib/useScrollLock";
import { supabase } from "@/lib/supabaseClient";
import {
  getStashedAccounts,
  switchToAccount,
  removeAccountFromStash,
  syncCurrentAccountIntoStash,
  type StashedAccount,
} from "@/lib/accountSwitcher";
import { getUserLocal } from "@/lib/authUser";

export default function AccountSwitcherSheet({ onClose }: { onClose: () => void }) {
  useScrollLock();
  const router = useRouter();
  const [accounts, setAccounts] = useState<StashedAccount[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // Make sure the account you're on right now is actually in the list
      // before showing it — otherwise a first-time user sees an empty sheet.
      await syncCurrentAccountIntoStash();
      setAccounts(getStashedAccounts());
      const {
        data: { user },
      } = await getUserLocal();
      setCurrentId(user?.id ?? null);
    })();
  }, []);

  useEffect(() => {
    window.history.pushState({ pictogramModal: "account-switcher" }, "");
    const onPopState = () => onClose();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClose() {
    window.history.back();
  }

  async function handleSwitch(account: StashedAccount) {
    if (account.userId === currentId) return handleClose();
    setSwitching(account.userId);
    const ok = await switchToAccount(account.userId);
    if (ok) {
      // Full reload — dozens of components independently read auth state on
      // mount, and a hard reload is the only way to guarantee every single
      // one of them picks up the new identity instead of showing stale data.
      window.location.href = "/";
    } else {
      setSwitching(null);
      removeAccountFromStash(account.userId);
      setAccounts(getStashedAccounts());
      alert("That account's session has expired. Please log in again to reconnect it.");
    }
  }

  function handleAddAccount() {
    router.push("/auth/login?add=1");
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50" onClick={handleClose}>
        <div className="safe-bottom w-full max-w-lg overflow-hidden rounded-t-2xl glass-card" onClick={(e) => e.stopPropagation()}>
          <p className="px-4 pt-4 text-sm font-semibold text-ink-muted">Switch account</p>

          <div className="py-2">
            {accounts.map((a) => (
              <div key={a.userId} className="flex items-center">
                <button
                  onClick={() => handleSwitch(a)}
                  disabled={!!switching}
                  className="flex flex-1 items-center gap-3 px-4 py-2.5 text-left disabled:opacity-60"
                >
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-brand-gradient">
                    {a.avatarUrl && <img src={a.avatarUrl} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <span className="flex-1 text-sm font-medium">{a.username}</span>
                  {switching === a.userId ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-from border-t-transparent" />
                  ) : a.userId === currentId ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="text-brand-from">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                </button>
                {a.userId !== currentId && !switching && (
                  <button
                    onClick={() => {
                      removeAccountFromStash(a.userId);
                      setAccounts(getStashedAccounts());
                    }}
                    aria-label={`Remove ${a.username}`}
                    className="px-3 py-2.5 text-ink-muted"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            ))}

            <button onClick={handleAddAccount} className="flex w-full items-center gap-3 px-4 py-2.5 text-left">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/5 dark:bg-white/10">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </div>
              <span className="text-sm font-medium">Add account</span>
            </button>
          </div>

          <button onClick={handleClose} className="w-full px-4 py-3.5 text-center text-[15px] font-semibold text-ink-muted">
            Cancel
          </button>
        </div>
      </div>
    </Portal>
  );
}
