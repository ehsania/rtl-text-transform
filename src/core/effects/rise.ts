import { clamp01 } from "../math";
import type { RiseFlow } from "../options";

export interface RiseTiming {
  /** Window for an entering hunk, in seconds. */
  window: number;
  /** Effective delay between neighbouring hunks, in seconds. */
  stagger: number;
  /** Fraction of the entering window used as overlap. */
  overlap: number;
}

export interface RiseTransform {
  /** Horizontal offset in em. */
  xEm: number;
  /** Vertical offset in em. */
  yEm: number;
  scale: number;
  /** Motion-blur strength in em. */
  blurEm: number;
}

function withoutNegativeZero(value: number): number {
  return value === 0 ? 0 : value;
}

const MAX_STAGGER_SHARE = 0.35;
const EXIT_DURATION = 0.7;

/**
 * Fit the archive's staggered hunk timing inside one shared morph duration.
 * The archive could run longer than its base duration; the unified engine keeps
 * every effect on the same clock instead.
 */
export function riseTiming(
  durationSeconds: number,
  hunkCount: number,
  staggerMs: number,
  overlap: number,
): RiseTiming {
  const duration = Math.max(0, durationSeconds);
  const count = Math.max(1, Math.floor(hunkCount));
  const configuredStagger = Math.max(0, staggerMs) / 1000;
  const stagger =
    count > 1 ? Math.min(configuredStagger, (duration * MAX_STAGGER_SHARE) / (count - 1)) : 0;
  const maxDelay = (count - 1) * stagger;
  const window = Math.max(0, duration - maxDelay) / (1 + overlap);
  return { window, stagger, overlap };
}

/** Local 0..1 progress for an entering hunk. */
export function enterProgress(elapsedSeconds: number, order: number, timing: RiseTiming): number {
  if (timing.window <= 0) return 1;
  const start = order * timing.stagger + timing.window * timing.overlap;
  return clamp01((elapsedSeconds - start) / timing.window);
}

/** Local 0..1 progress for an exiting hunk. */
export function exitProgress(elapsedSeconds: number, order: number, timing: RiseTiming): number {
  const duration = timing.window * EXIT_DURATION;
  if (duration <= 0) return 1;
  const start = order * timing.stagger;
  return clamp01((elapsedSeconds - start) / duration);
}

export function enterTransform(
  progress: number,
  travelEm: number,
  scale: number,
  blurEm: number,
  flow: RiseFlow,
): RiseTransform {
  const eased = clamp01(progress);
  const distance = travelEm * (1 - eased);
  let xEm = 0;
  let yEm = 0;

  if (flow === "up") yEm = distance;
  else if (flow === "down") yEm = -distance;
  else if (flow === "left") xEm = distance;
  else xEm = -distance;

  return {
    xEm: withoutNegativeZero(xEm),
    yEm: withoutNegativeZero(yEm),
    scale: 1 - (1 - scale) * (1 - eased),
    blurEm: blurEm * (1 - eased),
  };
}

export function exitTransform(
  progress: number,
  travelEm: number,
  scale: number,
  blurEm: number,
  flow: RiseFlow,
): RiseTransform {
  const eased = clamp01(progress);
  const distance = travelEm * 0.6 * eased;
  let xEm = 0;
  let yEm = 0;

  if (flow === "up") yEm = -distance;
  else if (flow === "down") yEm = distance;
  else if (flow === "left") xEm = -distance;
  else xEm = distance;

  return {
    xEm: withoutNegativeZero(xEm),
    yEm: withoutNegativeZero(yEm),
    scale: 1 - (1 - scale) * eased,
    blurEm: blurEm * eased,
  };
}
