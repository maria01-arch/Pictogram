export const FEED_ASPECTS = {
  "1:1": 1,
  "4:5": 4 / 5,
  "16:9": 16 / 9,
} as const;

export type FeedAspectKey = keyof typeof FEED_ASPECTS;

// Given a source's own aspect ratio and a target aspect ratio, returns the
// largest possible crop of that target shape, centered on (focalX, focalY)
// and clamped so it never reads outside the source's bounds. All values
// are 0-1, relative to the source's own dimensions — this is the exact
// same math a CSS `object-fit: cover; object-position: X% Y%` performs,
// which is why the live preview (CSS) and the final baked crop (canvas)
// end up matching.
export function computeCropRect(
  sourceWidth: number,
  sourceHeight: number,
  targetAspect: number,
  focalX = 0.5,
  focalY = 0.5
) {
  const sourceAspect = sourceWidth / sourceHeight;

  let cropWidthRatio: number;
  let cropHeightRatio: number;
  if (sourceAspect > targetAspect) {
    // Source is relatively wider than the target — crop its width, keep full height.
    cropHeightRatio = 1;
    cropWidthRatio = targetAspect / sourceAspect;
  } else {
    cropWidthRatio = 1;
    cropHeightRatio = sourceAspect / targetAspect;
  }

  const x = Math.min(Math.max(focalX - cropWidthRatio / 2, 0), 1 - cropWidthRatio);
  const y = Math.min(Math.max(focalY - cropHeightRatio / 2, 0), 1 - cropHeightRatio);

  return { x, y, width: cropWidthRatio, height: cropHeightRatio };
}

// Composes two normalized crop rects where `inner` is expressed relative
// to `outer`'s own 0-1 space (e.g. "the square cover guide's position
// within the already-frame-cropped preview") into a single crop rect
// expressed relative to the ORIGINAL source image — used when the cover
// crop is chosen as a sub-region of the main feed-frame crop rather than
// independently.
export function composeCrop(
  outer: { x: number; y: number; width: number; height: number },
  inner: { x: number; y: number; width: number; height: number }
) {
  return {
    x: outer.x + inner.x * outer.width,
    y: outer.y + inner.y * outer.height,
    width: inner.width * outer.width,
    height: inner.height * outer.height,
  };
}
