/**
 * Pure math for the goo morph effect.
 *
 * A "light fraction" is the amount of a text layer that is allowed through:
 * 1 = fully visible and sharp, 0 = fully transparent and maximally blurred.
 * These helpers contain no DOM access so they can be unit-tested and reused.
 */

export const MAX_BLUR_PX = 100;
export const OPACITY_EXPONENT = 0.4;

/** Clamp a number to the inclusive 0..1 range. NaN becomes 0. */
export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

/**
 * Blur in pixels for a layer at `fraction`.
 *
 * `min(blurEm * fontSizePx * (1 / fraction - 1), 100)`.
 * At fraction 1 the layer is sharp; at fraction 0 it is clamped to 100px.
 */
export function blurForFraction(fraction: number, fontSizePx: number, blurEm: number): number {
  const f = clamp01(fraction);
  if (f >= 1) return 0;
  if (f <= 0) return MAX_BLUR_PX;

  const fontSize = Number.isFinite(fontSizePx) && fontSizePx > 0 ? fontSizePx : 16;
  const blurEmSafe = Number.isFinite(blurEm) && blurEm > 0 ? blurEm : 0;
  const blur = blurEmSafe * fontSize * (1 / f - 1);
  return Math.min(MAX_BLUR_PX, Math.max(0, blur));
}

/** Opacity for a layer at `fraction`: `fraction ** 0.4`. */
export function opacityForFraction(fraction: number): number {
  return Math.pow(clamp01(fraction), OPACITY_EXPONENT);
}

export interface VisualState {
  blurPx: number;
  opacity: number;
}

/** Both layer visuals for a light fraction. */
export function visualForFraction(
  fraction: number,
  fontSizePx: number,
  blurEm: number,
): VisualState {
  return {
    blurPx: blurForFraction(fraction, fontSizePx, blurEm),
    opacity: opacityForFraction(fraction),
  };
}

/** CSS filter value for a threshold matrix row "0 0 0 255 -T". */
export function thresholdMatrix(threshold: number): string {
  const t = Math.max(0, Math.min(255, threshold));
  return `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 255 -${t}`;
}

/** Total length of one rest + morph cycle, in seconds. */
export function cycleDuration(morphTime: number, restTime: number): number {
  return Math.max(0, morphTime) + Math.max(0, restTime);
}

export interface CyclePosition {
  /** Zero-based cycle number for looping playback. */
  cycleIndex: number;
  /** Eased-agnostic morph fraction, 0..1. */
  fraction: number;
  /** True while the cycle is in its rest window. */
  atRest: boolean;
}

/**
 * Position inside the demo's rest-then-morph cycle.
 *
 * Elapsed time is split into `restTime` followed by `morphTime`. This mirrors
 * the original demo, which shows the current word during rest and morphs to
 * the next word afterwards.
 */
export function cyclePosition(elapsed: number, morphTime: number, restTime: number): CyclePosition {
  const rest = Math.max(0, restTime);
  const morph = Math.max(0, morphTime);
  const duration = rest + morph;

  if (duration <= 0) {
    return { cycleIndex: 0, fraction: 1, atRest: true };
  }

  const time = Math.max(0, elapsed);
  const cycleIndex = Math.floor(time / duration);
  const local = time - cycleIndex * duration;

  if (local < rest) {
    return { cycleIndex, fraction: 0, atRest: true };
  }
  if (morph <= 0) {
    return { cycleIndex, fraction: 1, atRest: true };
  }

  const fraction = clamp01((local - rest) / morph);
  return { cycleIndex, fraction, atRest: fraction >= 1 };
}

/** Wrap or clamp an index depending on the loop setting. */
export function wrapIndex(index: number, length: number, loop: boolean): number {
  if (length <= 0) return 0;
  if (loop) return ((index % length) + length) % length;
  return Math.max(0, Math.min(length - 1, index));
}

/** True when another word can be shown without wrapping. */
export function canAdvance(index: number, length: number, loop: boolean): boolean {
  if (length <= 1) return false;
  if (loop) return true;
  return index < length - 1;
}
