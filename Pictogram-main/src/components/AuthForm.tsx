"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);

    try {
      if (mode === "signup") {
        const trimmedUsername = username.trim();
        if (!/^[a-zA-Z0-9._]{3,20}$/.test(trimmedUsername)) {
          setError("Username must be 3-20 characters: letters, numbers, periods, or underscores only (no spaces).");
          setBusy(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: trimmedUsername } },
        });
        if (error) throw error;
        setNotice("Check your email to confirm your account, then log in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-6">
      <h1 className="bg-brand-gradient bg-clip-text text-3xl font-bold text-transparent">
        pictogram
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        {mode === "login" ? "Welcome back." : "Create your account."}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-3">
        {mode === "signup" && (
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            required
            minLength={3}
            className="w-full rounded-xl2 bg-black/5 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-from dark:bg-white/10"
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="w-full rounded-xl2 bg-black/5 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-from dark:bg-white/10"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          minLength={6}
          className="w-full rounded-xl2 bg-black/5 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-from dark:bg-white/10"
        />

        {error && <p className="text-sm text-red-500">{error}</p>}
        {notice && <p className="text-sm text-emerald-500">{notice}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-brand-gradient py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? "Please wait\u2026" : mode === "login" ? "Log in" : "Sign up"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-ink-muted">
        {mode === "login" ? (
          <>No account? <Link href="/auth/signup" className="font-semibold text-brand-from">Sign up</Link></>
        ) : (
          <>Already have one? <Link href="/auth/login" className="font-semibold text-brand-from">Log in</Link></>
        )}
      </p>
    </div>
  );
}
