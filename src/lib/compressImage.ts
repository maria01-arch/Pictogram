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

// Normalized (0-1) crop rectangle relative to the SOURCE image's own
// dimensions — e.g. { x: 0.1, y: 0, width: 0.8, height: 1 } crops 10% off
// each side. Used to bake a real aspect-ratio crop into the compressed
// file itself, instead of relying on CSS to fake it at render time.
export interface CropRect {
  x: number;
  y: number;
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
  { maxWidth = MAX_WIDTH, quality = QUALITY, crop }: { maxWidth?: number; quality?: number; crop?: CropRect } = {}
): Promise<CompressedImageResult> {
  const img = await loadImage(input);

  const sourceX = crop ? crop.x * img.naturalWidth : 0;
  const sourceY = crop ? crop.y * img.naturalHeight : 0;
  const sourceWidth = crop ? crop.width * img.naturalWidth : img.naturalWidth;
  const sourceHeight = crop ? crop.height * img.naturalHeight : img.naturalHeight;

  const scale = Math.min(1, maxWidth / sourceWidth);
  const targetWidth = Math.round(sourceWidth * scale);
  const targetHeight = Math.round(sourceHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);

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
