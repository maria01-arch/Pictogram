"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { compressImage } from "@/lib/compressImage";
import { getErrorMessage } from "@/lib/errorMessage";

type Step = "name" | "credentials" | "otp" | "profile";

const USERNAME_PATTERN = /^[a-zA-Z0-9._]{3,20}$/;

export default function SignupWizard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("name");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Step 1
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");

  // Step 2
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 3
  const [otp, setOtp] = useState("");

  // Step 4
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [age, setAge] = useState("");

  function handleNameNext(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedUsername = username.trim();
    if (!fullName.trim()) {
      setError("Enter your full name.");
      return;
    }
    if (!USERNAME_PATTERN.test(trimmedUsername)) {
      setError("Username must be 3-20 characters: letters, numbers, periods, or underscores only.");
      return;
    }
    setStep("credentials");
  }

  async function handleCredentialsNext(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username: username.trim(), display_name: fullName.trim() },
        },
      });
      if (error) throw error;
      setStep("otp");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleOtpNext(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp.trim(),
        type: "signup",
      });
      if (error) throw error;
      // verifyOtp logs the user in (session established) — move on to
      // filling out the rest of the profile.
      setStep("profile");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleResendOtp() {
    setError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) throw error;
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleFinish(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session expired — please sign up again.");

      let avatarUrl: string | null = null;
      if (avatarFile) {
        const { file } = await compressImage(avatarFile, { maxWidth: 400 });
        const path = `${user.id}/avatar-${Date.now()}.webp`;
        const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file);
        if (uploadError) throw uploadError;
        avatarUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }

      const parsedAge = age ? parseInt(age, 10) : null;
      if (age && (Number.isNaN(parsedAge) || parsedAge! < 13 || parsedAge! > 120)) {
        setError("Enter a valid age.");
        setBusy(false);
        return;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
          location: location.trim() || null,
          age: parsedAge,
        })
        .eq("id", user.id);
      if (updateError) throw updateError;

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const STEP_LABELS: Record<Step, string> = {
    name: "About you",
    credentials: "Your login",
    otp: "Verify your email",
    profile: "Finish your profile",
  };
  const STEP_ORDER: Step[] = ["name", "credentials", "otp", "profile"];

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-6">
      <h1 className="bg-brand-gradient bg-clip-text text-3xl font-bold text-transparent">
        pictogram
      </h1>
      <p className="mt-1 text-sm text-ink-muted">{STEP_LABELS[step]}</p>

      <div className="mt-4 flex gap-1.5">
        {STEP_ORDER.map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${
              STEP_ORDER.indexOf(s) <= STEP_ORDER.indexOf(step) ? "bg-brand-gradient" : "bg-black/10 dark:bg-white/10"
            }`}
          />
        ))}
      </div>

      {step === "name" && (
        <form onSubmit={handleNameNext} className="mt-6 space-y-3">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
            required
            className="w-full rounded-xl2 bg-black/5 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-from dark:bg-white/10"
          />
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            required
            minLength={3}
            className="w-full rounded-xl2 bg-black/5 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-from dark:bg-white/10"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button type="submit" className="w-full rounded-full bg-brand-gradient py-3 text-sm font-semibold text-white">
            Next
          </button>
        </form>
      )}

      {step === "credentials" && (
        <form onSubmit={handleCredentialsNext} className="mt-6 space-y-3">
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
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-brand-gradient py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Please wait…" : "Next"}
          </button>
          <button type="button" onClick={() => setStep("name")} className="w-full text-center text-sm text-ink-muted">
            Back
          </button>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={handleOtpNext} className="mt-6 space-y-3">
          <p className="text-xs text-ink-muted">
            We sent a code to <span className="font-medium">{email}</span>. Enter it below.
          </p>
          <input
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="6-digit code"
            required
            inputMode="numeric"
            className="w-full rounded-xl2 bg-black/5 p-3 text-center text-lg tracking-[0.4em] outline-none focus-visible:ring-2 focus-visible:ring-brand-from dark:bg-white/10"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-brand-gradient py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Please wait…" : "Confirm"}
          </button>
          <button type="button" onClick={handleResendOtp} disabled={busy} className="w-full text-center text-sm text-ink-muted">
            Resend code
          </button>
        </form>
      )}

      {step === "profile" && (
        <form onSubmit={handleFinish} className="mt-6 space-y-3">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-20 w-20 overflow-hidden rounded-full bg-brand-gradient"
            >
              {avatarPreview && <img src={avatarPreview} alt="" className="h-full w-full object-cover" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </div>
          <p className="text-center text-xs text-ink-muted">Tap to add a profile photo (optional)</p>

          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (optional)"
            className="w-full rounded-xl2 bg-black/5 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-from dark:bg-white/10"
          />
          <input
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="Age (optional)"
            type="number"
            min={13}
            max={120}
            className="w-full rounded-xl2 bg-black/5 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-from dark:bg-white/10"
          />

          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-brand-gradient py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Please wait…" : "Log in"}
          </button>
        </form>
      )}
    </div>
  );
}
