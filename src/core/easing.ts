export type EasingFunction = (t: number) => number;

/** Linear fallback, useful as an explicit opt-out. */
export function linear(t: number): number {
  return t;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

/**
 * CSS-style cubic-bezier easing.
 *
 * X control points are clamped to 0..1 so the curve remains a function of time.
 * Y values are left untouched for the caller to clamp if its property needs it.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFunction {
  const cx = 3 * clamp01(x1);
  const bx = 3 * (clamp01(x2) - clamp01(x1)) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number): number => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number): number => ((ay * t + by) * t + cy) * t;
  const sampleDerivativeX = (t: number): number => (3 * ax * t + 2 * bx) * t + cx;

  return (input: number): number => {
    if (input <= 0) return 0;
    if (input >= 1) return 1;

    let t = input;
    for (let step = 0; step < 8; step += 1) {
      const error = sampleX(t) - input;
      if (Math.abs(error) < 1e-6) return sampleY(t);

      const derivative = sampleDerivativeX(t);
      if (Math.abs(derivative) < 1e-6) break;
      t -= error / derivative;
    }

    let lower = 0;
    let upper = 1;
    t = clamp01(t);
    for (let step = 0; step < 20; step += 1) {
      const value = sampleX(t);
      if (Math.abs(value - input) < 1e-6) break;
      if (value < input) lower = t;
      else upper = t;
      t = (lower + upper) / 2;
    }

    return sampleY(t);
  };
}

/** Smooth symmetric curve for the overall morph. */
export const easeInOutCubic: EasingFunction = cubicBezier(0.65, 0, 0.35, 1);

/** Decelerating curve for entering and exiting hunks. */
export const easeOutCubic: EasingFunction = cubicBezier(0.33, 1, 0.68, 1);

export const DEFAULT_MORPH_EASING: EasingFunction = easeInOutCubic;
export const DEFAULT_RISE_EASING: EasingFunction = easeOutCubic;
