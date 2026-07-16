"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadPost, uploadStory, type UploadStage } from "@/lib/uploadMedia";

const STAGE_LABEL: Record<UploadStage, string> = {
  compressing: "Compressing your media\u2026",
  uploading: "Uploading\u2026",
  saving: "Saving\u2026",
  done: "Done!",
};

export default function CreatePostForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"post" | "story">("post");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [stage, setStage] = useState<UploadStage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  }

  async function handleSubmit() {
    if (!file) return;
    setError(null);
    try {
      if (mode === "post") {
        await uploadPost({ file, caption, onProgress: setStage });
      } else {
        await uploadStory({ file, onProgress: setStage });
      }
      router.push("/");
    } catch (err) {
      setStage(null);
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    }
  }

  const isVideo = file?.type.startsWith("video/");
  const busy = stage !== null && stage !== "done";

  return (
    <div className="px-4 pt-4 pb-8">
      {/* Post / Story toggle */}
      <div className="mb-4 flex gap-2 rounded-full bg-black/5 p-1 dark:bg-white/10">
        {(["post", "story"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-full py-2 text-sm font-semibold capitalize transition ${
              mode === m ? "bg-brand-gradient text-white" : "text-ink-muted"
            }`}
          >
            {m}
            {m === "story" && <span className="ml-1 text-xs font-normal">(24h)</span>}
          </button>
        ))}
      </div>

      {/* Media picker / preview */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        className="relative flex w-full items-center justify-center overflow-hidden rounded-xl2 border-2 border-dashed border-black/15 bg-black/5 dark:border-white/15 dark:bg-white/5"
        style={{ aspectRatio: 4 / 5 }}
      >
        {previewUrl ? (
          isVideo ? (
            <video src={previewUrl} className="h-full w-full object-cover" muted playsInline controls />
          ) : (
            <img src={previewUrl} alt="Selected media" className="h-full w-full object-cover" />
          )
        ) : (
          <div className="flex flex-col items-center gap-2 text-ink-muted">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 16l4-4a2 2 0 012.8 0l3 3M13 13l1.5-1.5a2 2 0 012.8 0L20 14M4 6h16v12H4V6z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm font-medium">Tap to choose a photo or video</span>
          </div>
        )}
      </button>

      {/* Caption — post only */}
      {mode === "post" && (
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Write a caption\u2026"
          rows={3}
          className="mt-4 w-full rounded-xl2 bg-black/5 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-from dark:bg-white/10"
        />
      )}

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      {busy && stage && (
        <p className="mt-3 text-sm text-ink-muted">{STAGE_LABEL[stage]}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!file || busy}
        className="mt-5 w-full rounded-full bg-brand-gradient py-3 text-sm font-semibold text-white transition disabled:opacity-40"
      >
        {busy ? STAGE_LABEL[stage!] : mode === "post" ? "Share post" : "Share to story"}
      </button>
    </div>
  );
}
