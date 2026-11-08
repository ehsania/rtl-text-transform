import { DEFAULT_RISE_EASING } from "./easing";
import type { EasingFunction } from "./easing";
import { MAX_BLUR_PX } from "./math";

export type MorphDirection = "rtl" | "ltr" | "auto";

export type RiseFlow = "up" | "down" | "left" | "right";

export interface RiseFlowHunk {
  /** Stable id for the changed chunk. */
  id: string;
  /** Added text enters; removed text exits. */
  kind: "add" | "remove";
  text: string;
  /** Source offset in the side's text. */
  start: number;
  end: number;
  /** Length of the side's text. */
  length: number;
  /** 0 at the start of the line, 1 at the end. */
  position: number;
}

export interface RiseFlowContext {
  from: string;
  to: string;
  dir: MorphDirection;
  rtl: boolean;
  hunk: RiseFlowHunk;
}

export type RiseFlowResolver = (context: RiseFlowContext) => RiseFlow;

export type RiseFlowValue = RiseFlow | RiseFlowResolver;

export type PresetName = "numbers" | "wordsHorizontal" | "wordsUp" | "wordsDown";

export type MotionName = "default" | "smooth" | "snappy" | "gentle";

export type MorphCallback = (from: string, to: string) => void;

export interface GooEffectOptions {
  /** Blur strength in em, scaled by the host's computed font size. */
  blur?: number;
  /**
   * Maximum goo blur in pixels. Defaults to 40px and is clamped to 0–100px.
   * Lower values are cheaper to render.
   */
  maxBlur?: number;
  /** Alpha threshold T in "0 0 0 255 -T". Clamped to 0–255. */
  threshold?: number;
  /** Keep the SVG filter mounted while the text is at rest. */
  atRest?: boolean;
}

export interface RiseEffectOptions {
  /** Motion blur strength in em. Applied on top of the goo blur. */
  blur?: number;
  /** Vertical travel in em. */
  travel?: number;
  /** Scale at the start of an entering hunk. */
  scale?: number;
  /** Delay between neighbouring hunks, in milliseconds. */
  stagger?: number;
  /** Fraction of the entering window that overlaps the outgoing hunk. */
  overlap?: number;
  /** Timing curve for each hunk's enter and exit progress. */
  easing?: EasingFunction;
  /**
   * Direction of travel. `up`: outgoing hunks leave upward and new hunks
   * arrive from below. `left`: outgoing hunks leave left and new hunks arrive
   * from the right. A function resolves the direction per changed hunk.
   */
  flow?: RiseFlowValue;
  /** Matched runs shorter than this are treated as changed text. */
  minChunk?: number;
  /** Treat Arabic/Persian kaf/yeh as the same letter for diffing. */
  normalizeVariants?: boolean;
  /** Do not let combining marks prevent a match. */
  ignoreDiacritics?: boolean;
}

export interface MorphEffects {
  /** Defaults to enabled with the standard goo settings. */
  goo?: boolean | GooEffectOptions;
  /** Defaults to disabled. */
  rise?: boolean | RiseEffectOptions;
}

export interface MorphOptions {
  /** Optional auto-cycling list. The first entry is shown immediately. */
  words?: string[];
  /** Length of one morph, in seconds. */
  morphTime?: number;
  /** Rest between automatic morphs, in seconds. */
  restTime?: number;
  effects?: MorphEffects;
  /** Content preset. See `presets`. */
  preset?: PresetName;
  /** Motion preset. Defaults to `default` when a content preset is used. */
  motion?: MotionName;
  dir?: MorphDirection;
  lang?: string;
  /** Start cycling `words` automatically. Defaults to true. */
  autoplay?: boolean;
  /** Wrap around at the end of `words`. Defaults to true. */
  loop?: boolean;
  /**
   * Timing curve for the overall morph and matched-text FLIP. Defaults to
   * ease-in-out cubic. Pass `t => t` for linear motion.
   */
  easing?: EasingFunction;
  onMorphStart?: MorphCallback;
  onMorphEnd?: MorphCallback;
}

export interface Morph {
  /** Morph from the current visual state to a new string. */
  setText(text: string): Promise<void>;
  /** Advance to the next entry in `words`. */
  next(): Promise<void>;
  setWords(words: string[]): void;
  play(): void;
  pause(): void;
  destroy(): void;
  update(partialOptions: Partial<MorphOptions>): void;
}

export interface ResolvedGoo {
  enabled: boolean;
  blur: number;
  maxBlur: number;
  threshold: number;
  atRest: boolean;
}

export interface ResolvedRise {
  enabled: boolean;
  blur: number;
  travel: number;
  scale: number;
  stagger: number;
  overlap: number;
  easing: EasingFunction;
  flow: RiseFlowValue;
  minChunk: number;
  normalizeVariants: boolean;
  ignoreDiacritics: boolean;
}

export interface ResolvedEffects {
  goo: ResolvedGoo;
  rise: ResolvedRise;
}

export const DEFAULT_MAX_GOO_BLUR_PX = 40;

export const DEFAULT_GOO: ResolvedGoo = {
  enabled: true,
  blur: 0.075,
  maxBlur: DEFAULT_MAX_GOO_BLUR_PX,
  threshold: 140,
  atRest: true,
};

export const DEFAULT_RISE: ResolvedRise = {
  enabled: false,
  blur: 0.1,
  travel: 0.3,
  scale: 0.94,
  stagger: 35,
  overlap: 0.15,
  easing: DEFAULT_RISE_EASING,
  flow: "up",
  minChunk: 2,
  normalizeVariants: true,
  ignoreDiacritics: true,
};

function nonNegative(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function clamp(value: number | undefined, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

export function normalizeThreshold(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 140;
  return Math.max(0, Math.min(255, Math.round(value)));
}

function gooFromOptions(options: GooEffectOptions, base: ResolvedGoo): ResolvedGoo {
  return {
    enabled: true,
    blur: nonNegative(options.blur, base.blur),
    maxBlur: clamp(options.maxBlur, 0, MAX_BLUR_PX, base.maxBlur),
    threshold:
      options.threshold === undefined ? base.threshold : normalizeThreshold(options.threshold),
    atRest: typeof options.atRest === "boolean" ? options.atRest : base.atRest,
  };
}

function riseFromOptions(options: RiseEffectOptions, base: ResolvedRise): ResolvedRise {
  return {
    enabled: true,
    blur: nonNegative(options.blur, base.blur),
    travel: nonNegative(options.travel, base.travel),
    scale: clamp(options.scale, 0, 1, base.scale),
    stagger: nonNegative(options.stagger, base.stagger),
    overlap: clamp(options.overlap, 0, 1, base.overlap),
    easing: typeof options.easing === "function" ? options.easing : base.easing,
    flow:
      options.flow === "up" ||
      options.flow === "down" ||
      options.flow === "left" ||
      options.flow === "right" ||
      typeof options.flow === "function"
        ? options.flow
        : base.flow,
    minChunk:
      typeof options.minChunk === "number" && Number.isFinite(options.minChunk)
        ? Math.max(0, Math.floor(options.minChunk))
        : base.minChunk,
    normalizeVariants:
      typeof options.normalizeVariants === "boolean"
        ? options.normalizeVariants
        : base.normalizeVariants,
    ignoreDiacritics:
      typeof options.ignoreDiacritics === "boolean"
        ? options.ignoreDiacritics
        : base.ignoreDiacritics,
  };
}

export function resolveInitialEffects(effects: MorphEffects | undefined): ResolvedEffects {
  const gooValue = effects?.goo;
  const riseValue = effects?.rise;

  const goo: ResolvedGoo =
    gooValue === false
      ? { ...DEFAULT_GOO, enabled: false }
      : gooValue === undefined || gooValue === true
        ? { ...DEFAULT_GOO }
        : gooFromOptions(gooValue, DEFAULT_GOO);

  const rise: ResolvedRise =
    riseValue === undefined || riseValue === false
      ? { ...DEFAULT_RISE, enabled: false }
      : riseValue === true
        ? { ...DEFAULT_RISE, enabled: true }
        : riseFromOptions(riseValue, DEFAULT_RISE);

  return { goo, rise };
}

export function applyGooPatch(
  current: ResolvedGoo,
  patch: boolean | GooEffectOptions | undefined,
): ResolvedGoo {
  if (patch === undefined) return current;
  if (patch === false) return { ...current, enabled: false };
  if (patch === true) return { ...current, enabled: true };
  return gooFromOptions(patch, current);
}

export function applyRisePatch(
  current: ResolvedRise,
  patch: boolean | RiseEffectOptions | undefined,
): ResolvedRise {
  if (patch === undefined) return current;
  if (patch === false) return { ...current, enabled: false };
  if (patch === true) return { ...current, enabled: true };
  return riseFromOptions(patch, current);
}
