"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { compressImage } from "@/lib/compressImage";
import { getErrorMessage } from "@/lib/errorMessage";
import type { Profile } from "@/types/database";

export default function ProfileEditForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        setProfile(data);
        setDisplayName(data.display_name ?? "");
        setBio(data.bio ?? "");
        setLocation(data.location ?? "");
        setAvatarPreview(data.avatar_url);
      }
      setLoading(false);
    }
    load();
  }, []);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    setError(null);

    try {
      let avatarUrl = profile.avatar_url;

      if (avatarFile) {
        const { file } = await compressImage(avatarFile, { maxWidth: 400 });
        const path = `${profile.id}/avatar-${Date.now()}.webp`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, file, { upsert: true, contentType: "image/webp" });
        if (uploadError) throw uploadError;
        avatarUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          display_name: displayName || null,
          bio: bio || null,
          location: location || null,
          avatar_url: avatarUrl,
        })
        .eq("id", profile.id);

      if (updateError) throw updateError;

      router.push("/menu");
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="px-4 py-6 text-sm text-ink-muted">Loading…</p>;

  return (
    <div className="px-4 pb-8 pt-4">
      <h2 className="text-lg font-bold">Account management</h2>

      <div className="mt-5 flex flex-col items-center">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="h-24 w-24 overflow-hidden rounded-full bg-brand-gradient"
        >
          {avatarPreview && <img src={avatarPreview} alt="" className="h-full w-full object-cover" />}
        </button>
        <p className="mt-2 text-xs text-ink-muted">Tap to change photo</p>
      </div>

      <div className="mt-6 space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-muted">Display name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-xl2 bg-black/5 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-from dark:bg-white/10"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-muted">Bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full rounded-xl2 bg-black/5 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-from dark:bg-white/10"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-muted">Location</span>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City, Country"
            className="w-full rounded-xl2 bg-black/5 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-from dark:bg-white/10"
          />
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-6 w-full rounded-full bg-brand-gradient py-3 text-sm font-semibold text-white disabled:opacity-40"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
