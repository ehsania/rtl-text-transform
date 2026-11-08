import { cubicBezier, easeInOutCubic, easeOutCubic, linear } from "rtl-text-transform";
import type { EasingFunction, MorphOptions, RiseFlow } from "rtl-text-transform";
import { PLAYGROUND_PATH } from "./config";

export type Mode = "goo" | "rise" | "both" | "fade";
export type Language = "fa" | "ar";
export type Speed = 1 | 0.5 | 0.25;
export type EasingKey = "linear" | "easeOutCubic" | "easeInOutCubic" | "cubicBezier";

export interface BaseState {
  mode: Mode;
  morphTime: number;
  restTime: number;
  gooBlur: number;
  threshold: number;
  atRest: boolean;
  riseBlur: number;
  travel: number;
  scale: number;
  stagger: number;
  overlap: number;
  flow: RiseFlow;
  minChunk: number;
  normalizeVariants: boolean;
  ignoreDiacritics: boolean;
  weight: number;
  speed: Speed;
  lang: Language;
  autoplay: boolean;
  loop: boolean;
  easing: EasingKey;
  riseEasing: EasingKey;
}

export const BASE_DEFAULTS: BaseState = {
  mode: "rise",
  morphTime: 0.3,
  restTime: 1.4,
  gooBlur: 0.1,
  threshold: 70,
  atRest: false,
  riseBlur: 0.04,
  travel: 0.24,
  scale: 0.96,
  stagger: 70,
  overlap: 0,
  flow: "right",
  minChunk: 2,
  normalizeVariants: true,
  ignoreDiacritics: true,
  weight: 800,
  speed: 1,
  lang: "fa",
  autoplay: true,
  loop: true,
  easing: "easeInOutCubic",
  riseEasing: "easeOutCubic",
};

export const EASING_FUNCTIONS: Record<EasingKey, EasingFunction> = {
  linear,
  easeOutCubic,
  easeInOutCubic,
  cubicBezier: cubicBezier(0.65, 0, 0.35, 1),
};

export const EASING_CODE: Record<EasingKey, string> = {
  linear: "linear",
  easeOutCubic: "easeOutCubic",
  easeInOutCubic: "easeInOutCubic",
  cubicBezier: "cubicBezier(0.65, 0, 0.35, 1)",
};

export const EASING_IMPORTS: Record<EasingKey, string | null> = {
  linear: "linear",
  easeOutCubic: "easeOutCubic",
  easeInOutCubic: "easeInOutCubic",
  cubicBezier: "cubicBezier",
};

export function baseState(overrides: Partial<BaseState> = {}): BaseState {
  return { ...BASE_DEFAULTS, ...overrides };
}

export function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function effectiveTimings(state: BaseState): {
  morphTime: number;
  restTime: number;
} {
  return {
    morphTime: round(state.morphTime / state.speed, 3),
    restTime: round(state.restTime / state.speed, 3),
  };
}

function gooEnabled(state: BaseState): boolean {
  return state.mode === "goo" || state.mode === "both";
}

function riseEnabled(state: BaseState): boolean {
  return state.mode === "rise" || state.mode === "both";
}

export function morphOptions(state: BaseState, words: string[] = []): MorphOptions {
  const timings = effectiveTimings(state);
  return {
    words,
    morphTime: timings.morphTime,
    restTime: timings.restTime,
    dir: "rtl",
    lang: state.lang,
    autoplay: state.autoplay,
    loop: state.loop,
    easing: EASING_FUNCTIONS[state.easing],
    effects: {
      goo: gooEnabled(state)
        ? {
            blur: state.gooBlur,
            threshold: state.threshold,
            atRest: state.atRest,
          }
        : false,
      rise: riseEnabled(state)
        ? {
            blur: state.riseBlur,
            travel: state.travel,
            scale: state.scale,
            stagger: state.stagger,
            overlap: state.overlap,
            flow: state.flow,
            minChunk: state.minChunk,
            normalizeVariants: state.normalizeVariants,
            ignoreDiacritics: state.ignoreDiacritics,
            easing: EASING_FUNCTIONS[state.riseEasing],
          }
        : false,
    },
  };
}

class Raw {
  constructor(public readonly value: string) {}
}

interface CodeInput {
  state: BaseState;
  words?: string[];
  weight?: number;
  extra?: string;
}

function optionObject(input: CodeInput): Record<string, unknown> {
  const { state, words } = input;
  const timings = effectiveTimings(state);
  const options: Record<string, unknown> = {};

  if (words && words.length > 0) options.words = words;
  if (timings.morphTime !== 1) options.morphTime = timings.morphTime;
  if (timings.restTime !== 0.25) options.restTime = timings.restTime;

  const gooOn = gooEnabled(state);
  const riseOn = riseEnabled(state);
  const effects: Record<string, unknown> = {};

  if (!gooOn && !riseOn) {
    effects.goo = false;
    effects.rise = false;
  } else {
    if (!gooOn) {
      effects.goo = false;
    } else {
      const goo: Record<string, unknown> = {};
      if (state.gooBlur !== 0.075) goo.blur = state.gooBlur;
      if (state.threshold !== 140) goo.threshold = Math.round(state.threshold);
      if (state.atRest !== true) goo.atRest = false;
      if (Object.keys(goo).length > 0) effects.goo = goo;
    }

    if (riseOn) {
      const rise: Record<string, unknown> = {};
      if (state.riseBlur !== 0.1) rise.blur = state.riseBlur;
      if (state.travel !== 0.3) rise.travel = state.travel;
      if (state.scale !== 0.94) rise.scale = state.scale;
      if (state.stagger !== 35) rise.stagger = Math.round(state.stagger);
      if (state.overlap !== 0.15) rise.overlap = state.overlap;
      if (state.flow !== "up") rise.flow = state.flow;
      if (state.minChunk !== 2) rise.minChunk = Math.round(state.minChunk);
      if (state.normalizeVariants !== true) rise.normalizeVariants = false;
      if (state.ignoreDiacritics !== true) rise.ignoreDiacritics = false;
      if (state.riseEasing !== "easeOutCubic") {
        rise.easing = new Raw(EASING_CODE[state.riseEasing]);
      }
      effects.rise = Object.keys(rise).length > 0 ? rise : true;
    }
  }

  if (Object.keys(effects).length > 0) options.effects = effects;
  if (state.autoplay !== true) options.autoplay = false;
  if (state.loop !== true) options.loop = false;
  if (state.easing !== "easeInOutCubic") {
    options.easing = new Raw(EASING_CODE[state.easing]);
  }

  return options;
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(round(value, 3));
}

function serialize(value: unknown, indent = 0): string {
  if (value instanceof Raw) return value.value;
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return formatNumber(value);
  if (typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const simple = value.every((item) => typeof item === "string");
    if (simple && value.length <= 2 && value.join("").length <= 42) {
      return `[${value.map((item) => JSON.stringify(item)).join(", ")}]`;
    }
    const pad = " ".repeat(indent + 2);
    const items = value.map((item) => `${pad}${serialize(item, indent + 2)},`);
    return `[\n${items.join("\n")}\n${" ".repeat(indent)}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    const pad = " ".repeat(indent + 2);
    const lines = entries.map(([key, item]) => `${pad}${key}: ${serialize(item, indent + 2)},`);
    return `{\n${lines.join("\n")}\n${" ".repeat(indent)}}`;
  }
  return "undefined";
}

function easingImports(input: CodeInput): string[] {
  const names = new Set<string>();
  if (input.state.easing !== "easeInOutCubic") {
    const name = EASING_IMPORTS[input.state.easing];
    if (name) names.add(name);
  }
  if (riseEnabled(input.state) && input.state.riseEasing !== "easeOutCubic") {
    const name = EASING_IMPORTS[input.state.riseEasing];
    if (name) names.add(name);
  }
  return [...names];
}

function codePreamble(input: CodeInput): string {
  const { state } = input;
  const imports = ["createMorph", ...easingImports(input)];
  const weight = input.weight ?? state.weight;
  return [
    `import { ${imports.join(", ")} } from "rtl-text-transform";`,
    "",
    `// Host: dir="rtl" lang="${state.lang}" style="font-family: Vazirmatn; font-weight: ${weight}"`,
    'const el = document.querySelector<HTMLElement>("#morph")!;',
    `el.style.fontWeight = "${weight}";`,
    "",
    `const morph = createMorph(el, ${serialize(optionObject(input))});`,
  ].join("\n");
}

export function buildExampleCode(input: CodeInput): string {
  return [codePreamble(input), input.extra ?? ""].filter((part) => part.length > 0).join("\n\n");
}

export function buildCompareCode(state: BaseState, words: string[]): string {
  const timings = effectiveTimings(state);
  const shared: Record<string, unknown> = {
    words,
    morphTime: timings.morphTime,
    restTime: timings.restTime,
  };
  if (!state.autoplay) shared.autoplay = false;
  if (!state.loop) shared.loop = false;
  if (state.easing !== "easeInOutCubic") {
    shared.easing = new Raw(EASING_CODE[state.easing]);
  }

  const modeEffects = (mode: Mode): Record<string, unknown> => {
    if (mode === "fade") return { goo: false, rise: false };
    const effects: Record<string, unknown> = {};
    if (mode === "rise") effects.goo = false;
    if (mode === "goo" || mode === "both") {
      const goo: Record<string, unknown> = {};
      if (state.gooBlur !== 0.075) goo.blur = state.gooBlur;
      if (state.threshold !== 140) goo.threshold = Math.round(state.threshold);
      if (state.atRest !== true) goo.atRest = false;
      if (Object.keys(goo).length > 0) effects.goo = goo;
    }
    if (mode === "rise" || mode === "both") {
      const rise: Record<string, unknown> = {};
      if (state.riseBlur !== 0.1) rise.blur = state.riseBlur;
      if (state.travel !== 0.3) rise.travel = state.travel;
      if (state.scale !== 0.94) rise.scale = state.scale;
      if (state.stagger !== 35) rise.stagger = Math.round(state.stagger);
      if (state.overlap !== 0.15) rise.overlap = state.overlap;
      if (state.flow !== "up") rise.flow = state.flow;
      if (state.minChunk !== 2) rise.minChunk = Math.round(state.minChunk);
      if (state.normalizeVariants !== true) rise.normalizeVariants = false;
      if (state.ignoreDiacritics !== true) rise.ignoreDiacritics = false;
      if (state.riseEasing !== "easeOutCubic") {
        rise.easing = new Raw(EASING_CODE[state.riseEasing]);
      }
      effects.rise = Object.keys(rise).length > 0 ? rise : true;
    }
    return effects;
  };

  const imports = ["createMorph", ...easingImports({ state, words })];
  const labels: Array<[Mode, string]> = [
    ["goo", "goo"],
    ["rise", "rise"],
    ["both", "both"],
    ["fade", "fade"],
  ];
  const calls = labels.map(([mode, id]) => {
    return `const ${id} = createMorph(document.querySelector<HTMLElement>("#${id}")!, {\n  ...base,\n  effects: ${serialize(modeEffects(mode))},\n});`;
  });

  return [
    `import { ${imports.join(", ")} } from "rtl-text-transform";`,
    "",
    `// Hosts: dir="rtl" lang="${state.lang}" font-family="Vazirmatn" font-weight="${state.weight}"`,
    `const base = ${serialize(shared)};`,
    "",
    ...calls,
  ].join("\n");
}

export function buildDeepLink(state: BaseState, words: string[], modeOverride?: Mode): string {
  const timings = effectiveTimings(state);
  const params = new URLSearchParams();
  params.set("mode", modeOverride ?? state.mode);
  params.set("morphTime", String(timings.morphTime));
  params.set("restTime", String(timings.restTime));
  params.set("gooBlur", String(state.gooBlur));
  params.set("threshold", String(Math.round(state.threshold)));
  params.set("gooAtRest", state.atRest ? "1" : "0");
  params.set("riseBlur", String(state.riseBlur));
  params.set("travel", String(state.travel));
  params.set("scale", String(state.scale));
  params.set("stagger", String(Math.round(state.stagger)));
  params.set("overlap", String(state.overlap));
  params.set("flow", state.flow);
  params.set("minChunk", String(Math.round(state.minChunk)));
  params.set("normalizeVariants", state.normalizeVariants ? "1" : "0");
  params.set("ignoreDiacritics", state.ignoreDiacritics ? "1" : "0");
  params.set("lang", state.lang);
  params.set("dir", "rtl");
  params.set("weight", String(state.weight));
  params.set("autoplay", state.autoplay ? "1" : "0");
  params.set("loop", state.loop ? "1" : "0");
  params.set("easing", state.easing);
  params.set("riseEasing", state.riseEasing);
  for (const word of words) params.append("word", word);
  return `${PLAYGROUND_PATH}?${params.toString()}`;
}

const TOKEN_RE =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:import|from|const|let|var|function|return|if|else|await|async|new|true|false|undefined|null|type|interface|export|default|for|of|in|throw|void|Promise|class|extends|implements|satisfies)\b|\b\d+(?:\.\d+)?\b)/g;

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function tokenClass(token: string): string | null {
  if (token.startsWith("//") || token.startsWith("/*")) return "tok-comment";
  if (token.startsWith('"') || token.startsWith("'") || token.startsWith("`")) {
    return "tok-string";
  }
  if (/^\d/.test(token)) return "tok-number";
  return "tok-keyword";
}

/** Small, dependency-free colouriser for snippets that change at runtime. */
export function highlightLive(code: string): string {
  let html = "";
  let last = 0;
  for (const match of code.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    html += escapeHtml(code.slice(last, index));
    const token = match[0];
    const cls = tokenClass(token);
    html += cls ? `<span class="${cls}">${escapeHtml(token)}</span>` : escapeHtml(token);
    last = index + token.length;
  }
  html += escapeHtml(code.slice(last));
  return html;
}
