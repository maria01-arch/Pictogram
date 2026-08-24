/**
 * compressVideo
 * -------------
 * Deliberately does NOT use ffmpeg.wasm — that's a multi-MB wasm download,
 * which is exactly the kind of bandwidth cost this app is trying to avoid,
 * and it's rough on low-end mobile CPUs.
 *
 * Instead this re-encodes the source video by piping it through an
 * offscreen <canvas> at a capped resolution/framerate and re-recording it
 * with the native MediaRecorder API (VP9, falling back to VP8). It's a
 * lighter, "good enough" compression pass for short-form social clips.
 *
 * Trade-off: this runs in real time (a 10s clip takes ~10s to process).
 * For anything beyond short clips, do the heavy encode server-side instead.
 */

const MAX_WIDTH = 720;
const MAX_DURATION_SECONDS = 60;
const TARGET_BITRATE = 1_500_000; // 1.5 Mbps — plenty for mobile feed video

export interface CompressedVideoResult {
  file: File;
  width: number;
  height: number;
  durationSeconds: number;
}

function pickMimeType(): string {
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  throw new Error("No supported video recording format on this device");
}

export async function compressVideo(input: File): Promise<CompressedVideoResult> {
  const sourceUrl = URL.createObjectURL(input);
  const video = document.createElement("video");
  video.src = sourceUrl;
  video.muted = true;
  video.playsInline = true;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Could not read video metadata"));
  });

  const duration = Math.min(video.duration, MAX_DURATION_SECONDS);
  const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
  const width = Math.round(video.videoWidth * scale);
  const height = Math.round(video.videoHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const canvasStream = canvas.captureStream(30); // 30fps cap
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(canvasStream, {
    mimeType,
    videoBitsPerSecond: TARGET_BITRATE,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const recordingDone = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });

  video.currentTime = 0;
  await video.play();
  recorder.start();

  await new Promise<void>((resolve) => {
    const draw = () => {
      if (video.currentTime >= duration || video.ended) {
        video.pause();
        recorder.stop();
        resolve();
        return;
      }
      ctx.drawImage(video, 0, 0, width, height);
      requestAnimationFrame(draw);
    };
    draw();
  });

  const blob = await recordingDone;
  URL.revokeObjectURL(sourceUrl);

  const fileName = input.name.replace(/\.[^/.]+$/, "") + ".webm";
  const file = new File([blob], fileName, { type: "video/webm" });

  return { file, width, height, durationSeconds: duration };
}

/**
 * Grabs a single frame (as a JPEG blob) to use as the Tap-to-Play thumbnail —
 * this is the ONLY thing loaded automatically for a video post/story.
 */
export async function extractThumbnail(input: File): Promise<Blob> {
  const sourceUrl = URL.createObjectURL(input);
  const video = document.createElement("video");
  video.src = sourceUrl;
  video.muted = true;

  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error("Could not load video for thumbnail"));
  });

  video.currentTime = Math.min(0.3, video.duration / 2);
  await new Promise((resolve) => (video.onseeked = resolve));

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(video, 0, 0);
  URL.revokeObjectURL(sourceUrl);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Thumbnail encoding failed"))), "image/jpeg", 0.7);
  });
}
