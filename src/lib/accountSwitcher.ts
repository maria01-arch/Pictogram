import { supabase } from "./supabaseClient";

const STORAGE_KEY = "pictogram_accounts";

export interface StashedAccount {
  userId: string;
  username: string;
  avatarUrl: string | null;
  accessToken: string;
  refreshToken: string;
}

function readStash(): StashedAccount[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeStash(accounts: StashedAccount[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

export function getStashedAccounts(): StashedAccount[] {
  return readStash();
}

// Saves (or updates) the currently active session into the stash. Call this
// after any login and after any switch — Supabase rotates refresh tokens on
// use, so the stash needs the freshest pair every time or the NEXT switch
// back to that account will fail.
export async function syncCurrentAccountIntoStash() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const { data: profile } = await supabase.from("profiles").select("username, avatar_url").eq("id", session.user.id).single();
  if (!profile) return;

  const accounts = readStash();
  const idx = accounts.findIndex((a) => a.userId === session.user.id);
  const entry: StashedAccount = {
    userId: session.user.id,
    username: profile.username,
    avatarUrl: profile.avatar_url,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  };
  if (idx >= 0) accounts[idx] = entry;
  else accounts.push(entry);
  writeStash(accounts);
}

export async function switchToAccount(userId: string): Promise<boolean> {
  const accounts = readStash();
  const target = accounts.find((a) => a.userId === userId);
  if (!target) return false;

  const { data, error } = await supabase.auth.setSession({
    access_token: target.accessToken,
    refresh_token: target.refreshToken,
  });
  if (error || !data.session) return false;

  // Persist whatever tokens Supabase just handed back — likely rotated —
  // so this account is still switchable to next time.
  await syncCurrentAccountIntoStash();
  return true;
}

export function removeAccountFromStash(userId: string) {
  writeStash(readStash().filter((a) => a.userId !== userId));
}

export function clearAccountStash() {
  writeStash([]);
}
