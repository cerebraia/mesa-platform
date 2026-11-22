// Automatic border detection for product images.
// Finds uniform-color strips at image edges (phone status bars, letterbox bars)
// by scanning each row/column from the edge inward and stopping at the first
// non-uniform line.

export interface FrameBox {
  top: number;    // px from top (in the analysis canvas dimensions)
  bottom: number;
  left: number;
  right: number;
}

// Pre-computed detection result that the CropTool stores in state.
export interface StoredFrame {
  displayTop: number;
  displayBottom: number;
  displayLeft: number;
  displayRight: number;
  topRatio: number;      // fraction of image height from top (0–1)
  bottomRatio: number;
  leftRatio: number;
  rightRatio: number;
  confidence: "high" | "medium";
}

// A strip must be at least this many analysis-canvas pixels thick.
// At the 1200-px analysis scale this equals ~2 % of a full-HD image height.
const MIN_STRIP_PX = 25;

// A strip wider than this fraction of the dimension is likely intentional
// framing rather than an artifact bar.
// Set to 0.22 (22 %) to fully capture phone status bars that reach ~19–20 %
// (e.g. 246 px out of 1278 px).  Auto-apply still requires HIGH_CONFIDENCE_PX,
// so a uniform product background of similar size shows a banner but does NOT
// snap the crop automatically — the user must confirm.
const MAX_STRIP_RATIO = 0.22;

// Max per-channel range (0–255) for a row/column to be considered "uniform".
const CHANNEL_RANGE = 20;

// Bars thicker than this are almost certainly phone chrome (status bar, nav bar).
// Below this threshold the banner is shown but the crop is not snapped automatically.
export const HIGH_CONFIDENCE_PX = 55;

function scanRow(ctx: CanvasRenderingContext2D, y: number, w: number): boolean {
  const { data } = ctx.getImageData(0, y, w, 1);
  let rLo = 255, rHi = 0, gLo = 255, gHi = 0, bLo = 255, bHi = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i]   < rLo) rLo = data[i];   if (data[i]   > rHi) rHi = data[i];
    if (data[i+1] < gLo) gLo = data[i+1]; if (data[i+1] > gHi) gHi = data[i+1];
    if (data[i+2] < bLo) bLo = data[i+2]; if (data[i+2] > bHi) bHi = data[i+2];
  }
  return rHi-rLo < CHANNEL_RANGE && gHi-gLo < CHANNEL_RANGE && bHi-bLo < CHANNEL_RANGE;
}

function scanCol(ctx: CanvasRenderingContext2D, x: number, h: number): boolean {
  const { data } = ctx.getImageData(x, 0, 1, h);
  let rLo = 255, rHi = 0, gLo = 255, gHi = 0, bLo = 255, bHi = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i]   < rLo) rLo = data[i];   if (data[i]   > rHi) rHi = data[i];
    if (data[i+1] < gLo) gLo = data[i+1]; if (data[i+1] > gHi) gHi = data[i+1];
    if (data[i+2] < bLo) bLo = data[i+2]; if (data[i+2] > bHi) bHi = data[i+2];
  }
  return rHi-rLo < CHANNEL_RANGE && gHi-gLo < CHANNEL_RANGE && bHi-bLo < CHANNEL_RANGE;
}

export function detectBorders(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): FrameBox {
  const maxV = Math.floor(h * MAX_STRIP_RATIO);
  const maxH = Math.floor(w * MAX_STRIP_RATIO);

  let top = 0;
  while (top < maxV && scanRow(ctx, top, w)) top++;
  if (top < MIN_STRIP_PX) top = 0;

  let bottom = 0;
  while (bottom < maxV && scanRow(ctx, h - 1 - bottom, w)) bottom++;
  if (bottom < MIN_STRIP_PX) {
    // Secondary pass: when the top strip is high-confidence (phone chrome),
    // also look for the iOS home indicator (~12–14 px) at the bottom.
    // Uses half the global threshold so it only triggers in this known context,
    // without lowering the global guard for standalone images.
    if (top >= HIGH_CONFIDENCE_PX) {
      // 8 px: enough to catch the iOS home indicator (12–14 px natural, 11 px
      // at analysis scale), well below the 25 px global minimum.
      const secondaryMin = 8;
      let bot2 = 0;
      while (bot2 < secondaryMin * 3 && scanRow(ctx, h - 1 - bot2, w)) bot2++;
      bottom = bot2 >= secondaryMin ? bot2 : 0;
    } else {
      bottom = 0;
    }
  }

  let left = 0;
  while (left < maxH && scanCol(ctx, left, h)) left++;
  if (left < MIN_STRIP_PX) left = 0;

  let right = 0;
  while (right < maxH && scanCol(ctx, w - 1 - right, h)) right++;
  if (right < MIN_STRIP_PX) right = 0;

  return { top, bottom, left, right };
}

export function hasDetectedBars(frame: FrameBox): boolean {
  return frame.top > 0 || frame.bottom > 0 || frame.left > 0 || frame.right > 0;
}

export function frameConfidence(frame: FrameBox): "high" | "medium" | "none" {
  const max = Math.max(frame.top, frame.bottom, frame.left, frame.right);
  if (max >= HIGH_CONFIDENCE_PX) return "high";
  if (max > 0)                    return "medium";
  return "none";
}
