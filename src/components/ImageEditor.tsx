"use client";

import { useEffect, useRef, useState } from "react";
import Portal from "./Portal";
import { useScrollLock } from "@/lib/useScrollLock";

type Tool = "none" | "draw" | "text" | "crop";
type Point = { x: number; y: number }; // normalized 0-1, relative to the CURRENT (rotated) canvas
type Stroke = { points: Point[]; color: string; width: number };
type TextLayer = { id: string; text: string; x: number; y: number; color: string };

const COLORS = ["#FFFFFF", "#000000", "#FF3B30", "#FFCC00", "#34C759", "#0A84FF"];
const STROKE_WIDTHS = [0.006, 0.012, 0.022]; // fraction of canvas width
const MAX_DIM = 1600;

// Rotating a normalized point 90° clockwise inside a box that itself swaps
// width/height. Used to keep strokes/text attached to the image when the
// user rotates after already drawing on it.
function rotatePoint90(p: Point): Point {
  return { x: 1 - p.y, y: p.x };
}

export default function ImageEditor({
  file,
  onCancel,
  onSend,
}: {
  file: File;
  onCancel: () => void;
  onSend: (result: { file: File; caption: string }) => void;
}) {
  useScrollLock();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [ready, setReady] = useState(false);
  const [rotation, setRotation] = useState(0); // 0 | 90 | 180 | 270
  const [tool, setTool] = useState<Tool>("none");
  const [color, setColor] = useState(COLORS[0]);
  const [widthIdx, setWidthIdx] = useState(1);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [draggingTextId, setDraggingTextId] = useState<string | null>(null);
  const [addingText, setAddingText] = useState(false);
  const [textDraft, setTextDraft] = useState("");
  const [crop, setCrop] = useState({ x0: 0, y0: 0, x1: 1, y1: 1 });
  const [draggingHandle, setDraggingHandle] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [sending, setSending] = useState(false);
  const currentStrokeRef = useRef<Stroke | null>(null);

  // Canvas pixel dims for the current rotation.
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
      setDims({ w: Math.round(img.naturalWidth * scale), h: Math.round(img.naturalHeight * scale) });
      setReady(true);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Redraw the canvas whenever anything changes.
  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const rotated90 = rotation === 90 || rotation === 270;
    const w = rotated90 ? dims.h : dims.w;
    const h = rotated90 ? dims.w : dims.h;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, -dims.w / 2, -dims.h / 2, dims.w, dims.h);
    ctx.restore();

    for (const s of strokes) {
      if (s.points.length < 2) continue;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width * w;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(s.points[0].x * w, s.points[0].y * h);
      for (const p of s.points.slice(1)) ctx.lineTo(p.x * w, p.y * h);
      ctx.stroke();
    }

    for (const t of textLayers) {
      ctx.font = `700 ${Math.round(w * 0.055)}px sans-serif`;
      ctx.fillStyle = t.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = w * 0.006;
      ctx.strokeStyle = t.color === "#000000" ? "#FFFFFF" : "#000000";
      ctx.strokeText(t.text, t.x * w, t.y * h);
      ctx.fillText(t.text, t.x * w, t.y * h);
    }
  }, [ready, rotation, dims, strokes, textLayers]);

  function canvasPointFromEvent(e: React.PointerEvent): Point {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  }

  function handleCanvasPointerDown(e: React.PointerEvent) {
    if (tool !== "draw") return;
    const p = canvasPointFromEvent(e);
    currentStrokeRef.current = { points: [p], color, width: STROKE_WIDTHS[widthIdx] };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function handleCanvasPointerMove(e: React.PointerEvent) {
    if (tool !== "draw" || !currentStrokeRef.current) return;
    currentStrokeRef.current.points.push(canvasPointFromEvent(e));
    // Live-preview the in-progress stroke directly for responsiveness;
    // the full strokes array (and this segment) gets committed on pointer up.
    const canvas = canvasRef.current;
    if (canvas) {
      // Live-preview the in-progress stroke directly for responsiveness.
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const s = currentStrokeRef.current;
        const last2 = s.points.slice(-2);
        if (last2.length === 2) {
          ctx.strokeStyle = s.color;
          ctx.lineWidth = s.width * canvas.width;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.beginPath();
          ctx.moveTo(last2[0].x * canvas.width, last2[0].y * canvas.height);
          ctx.lineTo(last2[1].x * canvas.width, last2[1].y * canvas.height);
          ctx.stroke();
        }
      }
    }
  }
  function handleCanvasPointerUp() {
    if (tool !== "draw" || !currentStrokeRef.current) return;
    setStrokes((prev) => [...prev, currentStrokeRef.current!]);
    currentStrokeRef.current = null;
  }

  function handleCanvasTap(e: React.PointerEvent) {
    if (tool !== "text" || draggingTextId) return;
    const p = canvasPointFromEvent(e);
    setTextDraft("");
    setAddingText(true);
    pendingTextPos.current = p;
  }
  const pendingTextPos = useRef<Point>({ x: 0.5, y: 0.5 });

  function confirmAddText() {
    if (textDraft.trim()) {
      setTextLayers((prev) => [
        ...prev,
        { id: crypto.randomUUID(), text: textDraft.trim(), color, ...pendingTextPos.current },
      ]);
    }
    setAddingText(false);
    setTextDraft("");
  }

  function rotate() {
    const next = ((rotation + 90) % 360) as 0 | 90 | 180 | 270;
    setStrokes((prev) => prev.map((s) => ({ ...s, points: s.points.map(rotatePoint90) })));
    setTextLayers((prev) => prev.map((t) => ({ ...t, ...rotatePoint90(t) })));
    setCrop({ x0: 0, y0: 0, x1: 1, y1: 1 }); // reset crop, rotated crop math isn't worth the complexity
    setRotation(next);
  }

  function handleTextDragMove(id: string, e: React.PointerEvent) {
    if (draggingTextId !== id) return;
    const p = canvasPointFromEvent(e);
    setTextLayers((prev) => prev.map((t) => (t.id === id ? { ...t, x: p.x, y: p.y } : t)));
  }

  function handleCornerDrag(handle: string, e: React.PointerEvent) {
    if (draggingHandle !== handle) return;
    const p = canvasPointFromEvent(e);
    setCrop((prev) => {
      const next = { ...prev };
      if (handle.includes("l")) next.x0 = Math.min(p.x, prev.x1 - 0.1);
      if (handle.includes("r")) next.x1 = Math.max(p.x, prev.x0 + 0.1);
      if (handle.includes("t")) next.y0 = Math.min(p.y, prev.y1 - 0.1);
      if (handle.includes("b")) next.y1 = Math.max(p.y, prev.y0 + 0.1);
      return next;
    });
  }

  async function handleSend() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSending(true);
    try {
      const cropped = document.createElement("canvas");
      const sx = crop.x0 * canvas.width;
      const sy = crop.y0 * canvas.height;
      const sw = (crop.x1 - crop.x0) * canvas.width;
      const sh = (crop.y1 - crop.y0) * canvas.height;
      cropped.width = sw;
      cropped.height = sh;
      const ctx = cropped.getContext("2d");
      ctx?.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

      const blob: Blob = await new Promise((resolve, reject) =>
        cropped.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png")
      );
      const outFile = new File([blob], "edited.png", { type: "image/png" });
      onSend({ file: outFile, caption: caption.trim() });
    } finally {
      setSending(false);
    }
  }

  const showCropHandles = tool === "crop";

  return (
    <Portal>
      <div className="fixed inset-0 z-[70] flex flex-col bg-black" style={{ height: "100dvh" }}>
        <div className="safe-top flex items-center justify-between px-4 py-3">
          <button onClick={onCancel} className="text-white" aria-label="Cancel">
            ✕
          </button>
          <button onClick={rotate} className="rounded-full bg-white/15 px-3 py-1.5 text-sm text-white" aria-label="Rotate">
            ⟳ Rotate
          </button>
        </div>

        <div ref={containerRef} className="relative flex flex-1 items-center justify-center overflow-hidden px-2">
          {!ready ? (
            <p className="text-sm text-white/70">Loading…</p>
          ) : (
            <div className="relative" style={{ maxWidth: "100%", maxHeight: "100%" }}>
              <canvas
                ref={canvasRef}
                onPointerDown={(e) => {
                  handleCanvasPointerDown(e);
                  handleCanvasTap(e);
                }}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onPointerCancel={handleCanvasPointerUp}
                className="max-h-[70dvh] max-w-full touch-none rounded-lg [-webkit-touch-callout:none]"
                style={{ width: "auto", height: "auto" }}
              />

              {textLayers.map((t) => (
                <div
                  key={t.id}
                  onPointerDown={(e) => {
                    if (tool !== "text") return;
                    e.stopPropagation();
                    setDraggingTextId(t.id);
                    (e.target as HTMLElement).setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => handleTextDragMove(t.id, e)}
                  onPointerUp={() => setDraggingTextId(null)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap px-1 text-lg font-bold"
                  style={{ left: `${t.x * 100}%`, top: `${t.y * 100}%`, color: t.color, touchAction: "none" }}
                >
                  {t.text}
                </div>
              ))}

              {showCropHandles && (
                <div className="pointer-events-none absolute inset-0">
                  <div
                    className="absolute border-2 border-white/90"
                    style={{
                      left: `${crop.x0 * 100}%`,
                      top: `${crop.y0 * 100}%`,
                      width: `${(crop.x1 - crop.x0) * 100}%`,
                      height: `${(crop.y1 - crop.y0) * 100}%`,
                    }}
                  />
                  {["tl", "tr", "bl", "br"].map((h) => (
                    <div
                      key={h}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setDraggingHandle(h);
                        (e.target as HTMLElement).setPointerCapture(e.pointerId);
                      }}
                      onPointerMove={(e) => handleCornerDrag(h, e)}
                      onPointerUp={() => setDraggingHandle(null)}
                      className="pointer-events-auto absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black/40 bg-white"
                      style={{
                        left: `${(h.includes("l") ? crop.x0 : crop.x1) * 100}%`,
                        top: `${(h.includes("t") ? crop.y0 : crop.y1) * 100}%`,
                        touchAction: "none",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {addingText && (
          <div className="flex items-center gap-2 border-t border-white/10 bg-black px-3 py-2">
            <input
              autoFocus
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              placeholder="Type text…"
              className="flex-1 rounded-full bg-white/10 px-4 py-2 text-white outline-none"
            />
            <button onClick={confirmAddText} className="rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white">
              Add
            </button>
          </div>
        )}

        {(tool === "draw" || tool === "text") && !addingText && (
          <div className="flex items-center justify-center gap-2 px-3 py-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full border-2 ${color === c ? "border-white" : "border-transparent"}`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
            {tool === "draw" && (
              <button
                onClick={() => setWidthIdx((i) => (i + 1) % STROKE_WIDTHS.length)}
                className="ml-2 grid h-8 w-8 place-items-center rounded-full bg-white/15 text-white"
                aria-label="Brush size"
              >
                <span style={{ fontSize: 10 + widthIdx * 6 }}>●</span>
              </button>
            )}
          </div>
        )}

        <div className="safe-bottom border-t border-white/10 bg-black">
          <div className="flex items-center justify-around px-2 py-2">
            {(["none", "crop", "draw", "text"] as Tool[]).map((t) => (
              <button
                key={t}
                onClick={() => setTool(tool === t ? "none" : t)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  tool === t ? "bg-white text-black" : "bg-white/10 text-white"
                }`}
              >
                {t === "none" ? "View" : t === "crop" ? "Crop" : t === "draw" ? "Draw" : "Text"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 px-3 pb-3">
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption…"
              className="flex-1 rounded-full bg-white/10 px-4 py-2.5 text-white outline-none placeholder:text-white/50"
            />
            <button
              onClick={handleSend}
              disabled={!ready || sending}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-gradient text-white disabled:opacity-40"
              aria-label="Send"
            >
              {sending ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                "➤"
              )}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
