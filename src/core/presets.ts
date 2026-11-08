import { cubicBezier, easeInOutCubic, easeOutCubic } from "./easing";
import type { MorphOptions, MotionName, PresetName, RiseFlow, RiseFlowContext } from "./options";

/**
 * Normalise Persian, Arabic-Indic and Latin digits, then return the first
 * numeric value in the string. Used by the numbers preset.
 */
export function firstNumber(value: string): number | undefined {
  const normalised = value
    .replace(/[۰-۹]/g, (digit) => String((digit.codePointAt(0) ?? 0x06f0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String((digit.codePointAt(0) ?? 0x0660) - 0x0660))
    .replace(/٬/g, "")
    .replace(/(\d),(?=\d)/g, "$1")
    .replace(/٫/g, ".");

  const match = normalised.match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : undefined;
}

/**
 * Numbers: up when the value increases, down when it decreases. Equal or
 * unparseable values fall back to up.
 */
export function flowByNumberChange(context: RiseFlowContext): RiseFlow {
  const from = firstNumber(context.from);
  const to = firstNumber(context.to);
  if (from === undefined || to === undefined || to === from) return "up";
  return to > from ? "up" : "down";
}

/**
 * Words: move every changed hunk toward the edge it belongs to. The exact
 * centre belongs to the end side. RTL flips the physical left/right mapping.
 */
export function flowByHunkPosition(context: RiseFlowContext): RiseFlow {
  const atStart = context.hunk.position < 0.5;
  if (context.rtl) return atStart ? "right" : "left";
  return atStart ? "left" : "right";
}

const wordGoo = { blur: 0.1, threshold: 70, atRest: false };
const wordRise = { blur: 0.04, travel: 0.24, scale: 0.96 };

export const presets = {
  numbers: {
    effects: {
      goo: { ...wordGoo },
      rise: {
        ...wordRise,
        blur: 0.1,
        travel: 0.6,
        scale: 0.9,
        flow: flowByNumberChange,
      },
    },
  },
  wordsHorizontal: {
    effects: {
      goo: { ...wordGoo },
      rise: { ...wordRise, flow: flowByHunkPosition },
    },
  },
  wordsUp: {
    effects: {
      goo: { ...wordGoo },
      rise: { ...wordRise, flow: "up" },
    },
  },
  wordsDown: {
    effects: {
      goo: { ...wordGoo },
      rise: { ...wordRise, flow: "down" },
    },
  },
} satisfies Record<PresetName, MorphOptions>;

export const motions = {
  default: {
    morphTime: 0.3,
    easing: easeInOutCubic,
    effects: {
      rise: { easing: easeOutCubic, stagger: 70, overlap: 0 },
    },
  },
  smooth: {
    morphTime: 0.8,
    easing: easeInOutCubic,
    effects: {
      rise: {
        easing: cubicBezier(0.25, 0.8, 0.35, 1),
        stagger: 30,
        overlap: 0.18,
      },
    },
  },
  snappy: {
    morphTime: 0.2,
    easing: cubicBezier(0.2, 0.8, 0.2, 1),
    effects: {
      rise: {
        easing: cubicBezier(0.16, 1, 0.3, 1),
        stagger: 50,
        overlap: 0,
      },
    },
  },
  gentle: {
    morphTime: 1.1,
    easing: easeInOutCubic,
    effects: {
      rise: {
        easing: cubicBezier(0.42, 0, 0.58, 1),
        stagger: 45,
        overlap: 0.2,
      },
    },
  },
} satisfies Record<MotionName, MorphOptions>;

export const presetNames = Object.keys(presets) as PresetName[];
export const motionNames = Object.keys(motions) as MotionName[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeValue(base: unknown, override: unknown): unknown {
  if (override === undefined) return base;
  if (Array.isArray(override)) return [...override];
  if (isRecord(base) && isRecord(override)) return mergeOptions(base, override);
  return override;
}

function mergeOptions(
  ...sources: Array<MorphOptions | Record<string, unknown> | undefined>
): MorphOptions {
  const merged: Record<string, unknown> = {};

  for (const source of sources) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      if (key === "preset" || key === "motion" || value === undefined) continue;
      merged[key] = mergeValue(merged[key], value);
    }
  }

  return merged as MorphOptions;
}

/**
 * Resolve `preset` and `motion` into concrete core options. Preset values are
 * applied first, the motion next, and explicit options last.
 */
export function resolveMorphOptions(options: MorphOptions): MorphOptions {
  const { preset, motion, ...overrides } = options;
  if (!preset && !motion) return options;

  const motionName: MotionName | undefined = motion ?? (preset ? "default" : undefined);

  return mergeOptions(
    preset ? presets[preset] : undefined,
    motionName ? motions[motionName] : undefined,
    overrides,
  );
}

/**
 * Resolve a named content preset with optional motion and inline overrides.
 */
export function resolvePreset(name: PresetName, overrides: MorphOptions = {}): MorphOptions {
  return resolveMorphOptions({ ...overrides, preset: name });
}

export function isRiseFlow(value: unknown): value is RiseFlow {
  return value === "up" || value === "down" || value === "left" || value === "right";
}
