/**
 * compressImage
 * -------------
 * Resizes an image to a max width of 1080px and re-encodes it as .webp
 * entirely in the browser, before it ever touches Supabase Storage.
 * This is what keeps upload bandwidth and storage cost low.
 */

const MAX_WIDTH = 1080;
const QUALITY = 0.8; // 0–1, .webp quality

export interface CompressedImageResult {
  file: File;
  width: number;
  height: number;
}

export async function compressImage(
  input: File,
  { maxWidth = MAX_WIDTH, quality = QUALITY }: { maxWidth?: number; quality?: number } = {}
): Promise<CompressedImageResult> {
  const bitmap = await createImageBitmap(input);

  const scale = Math.min(1, maxWidth / bitmap.width);
  const targetWidth = Math.round(bitmap.width * scale);
  const targetHeight = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close();

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("WebP encoding failed"))),
      "image/webp",
      quality
    );
  });

  const fileName = input.name.replace(/\.[^/.]+$/, "") + ".webp";
  const file = new File([blob], fileName, { type: "image/webp" });

  return { file, width: targetWidth, height: targetHeight };
}

/**
 * Generates a tiny (32px-wide) placeholder JPEG data URL for instant
 * paint while the full compressed image is still uploading/loading.
 * Cheap stand-in for a full blurhash pipeline.
 */
export async function generateTinyPlaceholder(input: File): Promise<string> {
  const bitmap = await createImageBitmap(input);
  const scale = 32 / bitmap.width;

  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = Math.round(bitmap.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.filter = "blur(2px)";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", 0.5);
}
