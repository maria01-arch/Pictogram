"use client";

import { useEffect, useRef, useState } from "react";
import { FEED_ASPECTS, computeCropRect, type FeedAspectKey } from "../lib/cropMath";

export interface MediaEditorResult {
  aspect: FeedAspectKey;
  focalX: number;
  focalY: number;
  coverFocalX: number;
  coverFocalY: number;
  customCoverFile: File | null;
}

export default function PostMediaEditor({
  file,
  onDone,
}: {
  file: File;
  onDone: (result: MediaEditorResult) => void;
}) {
  const isVideo = file.type.startsWith("video/");
  const previewUrlRef = useRef(URL.createObjectURL(file));

  const [aspect, setAspect] = useState<FeedAspectKey>("4:5");
  const [focalX, setFocalX] = useState(0.5);
  const [focalY, setFocalY] = useState(0.5);
  const [step, setStep] = useState<"frame" | "cover">("frame");
  const [coverFocalX, setCoverFocalX] = useState(0.5);
  const [coverFocalY, setCoverFocalY] = useState(0.5);
  const [customCoverFile, setCustomCoverFile] = useState<File | null>(null);
  const [customCoverPreview, setCustomCoverPreview] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startFocalX: number; startFocalY: number } | null>(null);

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(previewUrlRef.current);
      if (customCoverPreview) URL.revokeObjectURL(customCoverPreview);
    };
  }, []);

  function beginDrag(clientX: number, clientY: number, curX: number, curY: number) {
    dragRef.current = { startX: clientX, startY: clientY, startFocalX: curX, startFocalY: curY };
  }
  function continueDrag(clientX: number, clientY: number, setX: (v: number) => void, setY: (v: number) => void) {
    if (!dragRef.current || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const dx = (clientX - dragRef.current.startX) / rect.width;
    const dy = (clientY - dragRef.current.startY) / rect.height;
    setX(Math.min(1, Math.max(0, dragRef.current.startFocalX - dx)));
    setY(Math.min(1, Math.max(0, dragRef.current.startFocalY - dy)));
  }
  function endDrag() {
    dragRef.current = null;
  }

  function handleCoverFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (customCoverPreview) URL.revokeObjectURL(customCoverPreview);
    setCustomCoverFile(f);
    setCustomCoverPreview(URL.createObjectURL(f));
    setCoverFocalX(0.5);
    setCoverFocalY(0.5);
  }

  function handleContinue() {
    if (aspect === "1:1") {
      // The main frame is already square — nothing further to crop for the grid.
      onDone({ aspect, focalX, focalY, coverFocalX: focalX, coverFocalY: focalY, customCoverFile });
      return;
    }
    if (step === "frame") {
      setStep("cover");
      return;
    }
    onDone({ aspect, focalX, focalY, coverFocalX, coverFocalY, customCoverFile });
  }

  // The largest square that fits inside the chosen frame aspect, positioned
  // by the cover focal point — reused both to size/position the drag guide
  // and (via cropMath's composeCrop, applied at upload time) to compute the
  // actual baked cover crop.
  const squareGuide = computeCropRect(FEED_ASPECTS[aspect], 1, 1, coverFocalX, coverFocalY);

  return (
    <div>
      {step === "frame" ? (
        <>
          <div className="mb-3 flex gap-2">
            {(Object.keys(FEED_ASPECTS) as FeedAspectKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setAspect(key)}
                className={`flex-1 rounded-full py-1.5 text-xs font-semibold ${
                  aspect === key ? "bg-brand-gradient text-white" : "bg-black/5 dark:bg-white/10"
                }`}
              >
                {key === "1:1" ? "Square" : key === "4:5" ? "Portrait" : "Landscape"}
              </button>
            ))}
          </div>

          <div
            ref={frameRef}
            className="relative mx-auto touch-none select-none overflow-hidden rounded-xl2 bg-black"
            style={{ aspectRatio: FEED_ASPECTS[aspect], maxHeight: "60vh" }}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              beginDrag(e.clientX, e.clientY, focalX, focalY);
            }}
            onPointerMove={(e) => continueDrag(e.clientX, e.clientY, setFocalX, setFocalY)}
            onPointerUp={endDrag}
          >
            {isVideo ? (
              <video
                src={previewUrlRef.current}
                className="h-full w-full object-cover"
                style={{ objectPosition: `${focalX * 100}% ${focalY * 100}%` }}
                muted
                playsInline
                autoPlay
                loop
              />
            ) : (
              <img
                src={previewUrlRef.current}
                alt=""
                className="h-full w-full object-cover"
                style={{ objectPosition: `${focalX * 100}% ${focalY * 100}%` }}
                draggable={false}
              />
            )}
          </div>
          <p className="mt-2 text-center text-xs text-ink-muted">Drag to reposition</p>
        </>
      ) : (
        <>
          <p className="mb-1 text-sm font-semibold">Adjust your square cover crop</p>
          <p className="mb-3 text-xs text-ink-muted">
            This is how the post appears as a square tile on your profile grid.
          </p>

          <div
            ref={frameRef}
            className="relative mx-auto touch-none select-none overflow-hidden rounded-xl2 bg-black"
            style={{ aspectRatio: FEED_ASPECTS[aspect], maxHeight: "50vh" }}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              beginDrag(e.clientX, e.clientY, coverFocalX, coverFocalY);
            }}
            onPointerMove={(e) => continueDrag(e.clientX, e.clientY, setCoverFocalX, setCoverFocalY)}
            onPointerUp={endDrag}
          >
            {isVideo && !customCoverFile ? (
              <video
                src={previewUrlRef.current}
                className="h-full w-full object-cover"
                style={{ objectPosition: `${focalX * 100}% ${focalY * 100}%` }}
                muted
                playsInline
                autoPlay
                loop
              />
            ) : (
              <img
                src={customCoverPreview ?? previewUrlRef.current}
                alt=""
                className="h-full w-full object-cover"
                style={{ objectPosition: customCoverFile ? "center" : `${focalX * 100}% ${focalY * 100}%` }}
                draggable={false}
              />
            )}

            {/* Dimmed outside the square guide, via a box-shadow that fills
                everything but the guide itself — clipped by the parent's
                overflow-hidden so it never spills past the frame. */}
            <div
              className="pointer-events-none absolute border-2 border-white"
              style={{
                left: `${squareGuide.x * 100}%`,
                top: `${squareGuide.y * 100}%`,
                width: `${squareGuide.width * 100}%`,
                height: `${squareGuide.height * 100}%`,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
              }}
            />
          </div>
          <p className="mt-2 text-center text-xs text-ink-muted">Drag to reposition</p>

          <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverFileChange} className="hidden" />
          <button
            onClick={() => coverInputRef.current?.click()}
            className="mt-3 w-full rounded-full bg-black/5 py-2 text-xs font-semibold dark:bg-white/10"
          >
            {customCoverFile ? "Change custom cover image" : "Use a different image as cover"}
          </button>
        </>
      )}

      <div className="mt-4 flex gap-2">
        {step === "cover" && (
          <button
            onClick={() => setStep("frame")}
            className="rounded-full bg-black/5 px-4 py-2.5 text-sm font-semibold dark:bg-white/10"
          >
            Back
          </button>
        )}
        <button onClick={handleContinue} className="flex-1 rounded-full bg-brand-gradient py-2.5 text-sm font-semibold text-white">
          {aspect !== "1:1" && step === "frame" ? "Next: cover crop" : "Continue"}
        </button>
      </div>
    </div>
  );
}
