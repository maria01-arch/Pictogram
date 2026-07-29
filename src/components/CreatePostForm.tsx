"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadPost, uploadStory, uploadCarouselPost, type UploadStage } from "@/lib/uploadMedia";
import { uploadTextPost, uploadTextStory, wordCount, MIN_TEXT_POST_WORDS } from "@/lib/uploadText";
import { getErrorMessage } from "@/lib/errorMessage";

const STAGE_LABEL: Record<UploadStage, string> = {
  compressing: "Compressing your media…",
  uploading: "Uploading…",
  saving: "Saving…",
  done: "Done!",
};

export default function CreatePostForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"post" | "story">("post");
  const [contentType, setContentType] = useState<"media" | "text">("media");
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [textBody, setTextBody] = useState("");
  const [stage, setStage] = useState<UploadStage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;
    setError(null);

    previewUrls.forEach((url) => URL.revokeObjectURL(url));

    if (selected.length > 1 && selected.some((f) => f.type.startsWith("video/"))) {
      setError("Carousels support photos only — no videos. Select a single video to post one instead.");
      setFiles([]);
      setPreviewUrls([]);
      return;
    }

    setFiles(selected);
    setPreviewUrls(selected.map((f) => URL.createObjectURL(f)));
  }

  function removeFileAt(index: number) {
    URL.revokeObjectURL(previewUrls[index]);
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setError(null);

    try {
      if (contentType === "text") {
        if (mode === "post") {
          await uploadTextPost(textBody);
        } else {
          await uploadTextStory(textBody);
        }
        router.push("/");
        return;
      }

      if (files.length === 0) return;

      if (mode === "post" && files.length > 1) {
        await uploadCarouselPost({ files, caption, onProgress: setStage });
      } else if (mode === "post") {
        await uploadPost({ file: files[0], caption, onProgress: setStage });
      } else {
        await uploadStory({ file: files[0], onProgress: setStage });
      }
      router.push("/");
    } catch (err) {
      setStage(null);
      setError(getErrorMessage(err));
    }
  }

  const isVideo = files.length === 1 && files[0].type.startsWith("video/");
  const busy = stage !== null && stage !== "done";
  const words = wordCount(textBody);
  const textTooShort = mode === "post" && words < MIN_TEXT_POST_WORDS;
  const canSubmit = contentType === "text" ? textBody.trim().length > 0 && !textTooShort : files.length > 0;

  return (
    <div className="px-4 pt-4 pb-8">
      <div className="mb-3 flex gap-2 rounded-full bg-black/5 p-1 dark:bg-white/10">
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

      <div className="mb-4 flex gap-2 rounded-full bg-black/5 p-1 dark:bg-white/10">
        {(["media", "text"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setContentType(t)}
            className={`flex-1 rounded-full py-1.5 text-xs font-semibold capitalize transition ${
              contentType === t ? "bg-brand-gradient text-white" : "text-ink-muted"
            }`}
          >
            {t === "media" ? "Photo / Video" : "Text only"}
          </button>
        ))}
      </div>

      {contentType === "media" ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple={mode === "post"}
            onChange={handleFileChange}
            className="hidden"
          />

          {previewUrls.length === 0 ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="relative flex w-full items-center justify-center overflow-hidden rounded-xl2 border-2 border-dashed border-black/15 bg-black/5 dark:border-white/15 dark:bg-white/5"
              style={{ aspectRatio: 4 / 5 }}
            >
              <div className="flex flex-col items-center gap-2 text-ink-muted">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 16l4-4a2 2 0 012.8 0l3 3M13 13l1.5-1.5a2 2 0 012.8 0L20 14M4 6h16v12H4V6z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-sm font-medium">
                  {mode === "post" ? "Tap to choose photo(s) or a video" : "Tap to choose a photo or video"}
                </span>
              </div>
            </button>
          ) : previewUrls.length === 1 ? (
            <div className="relative overflow-hidden rounded-xl2" style={{ aspectRatio: 4 / 5 }}>
              {isVideo ? (
                <video src={previewUrls[0]} className="h-full w-full object-cover" muted playsInline controls />
              ) : (
                <img src={previewUrls[0]} alt="Selected media" className="h-full w-full object-cover" />
              )}
              <button
                onClick={() => { setFiles([]); setPreviewUrls([]); }}
                className="absolute right-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white"
              >
                Change
              </button>
            </div>
          ) : (
            <div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {previewUrls.map((url, i) => (
                  <div key={i} className="relative h-32 w-32 shrink-0 overflow-hidden rounded-xl2">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      onClick={() => removeFileAt(i)}
                      className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-xs text-white"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="grid h-32 w-32 shrink-0 place-items-center rounded-xl2 border-2 border-dashed border-black/15 text-ink-muted dark:border-white/15"
                >
                  + Add
                </button>
              </div>
              <p className="mt-1.5 text-xs text-ink-muted">{previewUrls.length} photos — will post as a carousel</p>
            </div>
          )}

          {mode === "post" && (
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write a caption… (#hashtags work too)"
              rows={3}
              className="mt-4 w-full rounded-xl2 bg-black/5 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-from dark:bg-white/10"
            />
          )}
        </>
      ) : (
        <div>
          <textarea
            value={textBody}
            onChange={(e) => setTextBody(e.target.value)}
            placeholder={mode === "post" ? `Write at least ${MIN_TEXT_POST_WORDS} words…` : "What's on your mind?"}
            rows={10}
            className="w-full rounded-xl2 bg-black/5 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-from dark:bg-white/10"
          />
          {mode === "post" && (
            <p className={`mt-1.5 text-xs ${textTooShort ? "text-red-500" : "text-ink-muted"}`}>
              {words} / {MIN_TEXT_POST_WORDS} words minimum
            </p>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      {busy && stage && <p className="mt-3 text-sm text-ink-muted">{STAGE_LABEL[stage]}</p>}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit || busy}
        className="mt-5 w-full rounded-full bg-brand-gradient py-3 text-sm font-semibold text-white transition disabled:opacity-40"
      >
        {busy ? STAGE_LABEL[stage!] : mode === "post" ? "Share post" : "Share to story"}
      </button>
    </div>
  );
}
