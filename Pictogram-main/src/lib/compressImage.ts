/**
 * compressImage
 * -------------
 * Resizes an image to a max width of 1080px and re-encodes it as .webp
 * entirely in the browser. Uses an HTMLImageElement + canvas instead of
 * createImageBitmap(), which has inconsistent decode support for some
 * formats/EXIF orientations in Android WebViews (Brave included).
 */

const MAX_WIDTH = 1080;
const QUALITY = 0.8;

export interface CompressedImageResult {
  file: File;
  width: number;
  height: number;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode the selected image. Try a different photo."));
    };
    img.src = url;
  });
}

export async function compressImage(
  input: File,
  { maxWidth = MAX_WIDTH, quality = QUALITY }: { maxWidth?: number; quality?: number } = {}
): Promise<CompressedImageResult> {
  const img = await loadImage(input);

  const scale = Math.min(1, maxWidth / img.naturalWidth);
  const targetWidth = Math.round(img.naturalWidth * scale);
  const targetHeight = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

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

export async function generateTinyPlaceholder(input: File): Promise<string> {
  const img = await loadImage(input);
  const scale = 32 / img.naturalWidth;

  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = Math.round(img.naturalHeight * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.filter = "blur(2px)";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL("image/jpeg", 0.5);
}
