import type { RiseTiming } from "./effects/rise";
import type { MorphDirection, RiseFlow, RiseFlowContext, RiseFlowValue } from "./options";
import { isRiseFlow } from "./presets";
import { atomSourceRange } from "./scene";
import type { ChunkView, DiffScene } from "./scene";

export type TransitionMode = "goo" | "rise" | "fade";

export interface Transition {
  from: string;
  to: string;
  mode: TransitionMode;
  duration: number;
  elapsed: number;
  raw: number;
  eased: number;
  /** Light fraction for goo mode, opacity for fade mode. */
  outStart: number;
  scene?: DiffScene;
  enter: ChunkView[];
  exit: ChunkView[];
  flow: RiseFlow;
  flowByChunk?: Map<string, RiseFlow>;
  timing?: RiseTiming;
  fastForward: boolean;
  promise: Promise<void>;
  resolve: () => void;
}

export interface PendingMorph {
  text: string;
  promise: Promise<void>;
  resolve: () => void;
}

export interface SavedStyle {
  position: string;
  display: string;
  minHeight: string;
  width: string;
  filter: string;
}

export const DEFAULT_FONT_SIZE = 16;
export const MAX_FRAME_DELTA = 0.1;
export const REDUCED_MOTION_FADE = 0.18;
export const NO_EFFECT_FADE = 0.3;
export const FAST_FORWARD = 0.12;
export const GOO_SOFTEN = " blur(0.6px)";

export function nonNegative(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : fallback;
}

export function sameWords(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((word, index) => word === b[index]);
}

export function prefersReducedMotion(doc: Document): boolean {
  const view = doc.defaultView;
  if (!view || typeof view.matchMedia !== "function") return false;
  try {
    return view.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function reportCallbackError(error: unknown): void {
  if (typeof console !== "undefined" && typeof console.error === "function") {
    console.error("[rtl-text-transform]", error);
  }
}

export function combineBlur(gooPx: number, risePx: number): string {
  const goo = Math.max(0, gooPx);
  const rise = Math.max(0, risePx);
  if (goo < 0.01 && rise < 0.01) return "none";
  if (goo < 0.01) return `blur(${rise.toFixed(2)}px)`;
  if (rise < 0.01) return `blur(${goo.toFixed(2)}px)`;
  return `blur(${goo.toFixed(2)}px) blur(${rise.toFixed(2)}px)`;
}

function resolveFlow(flow: RiseFlowValue, context: RiseFlowContext): RiseFlow {
  if (typeof flow !== "function") return flow;
  try {
    const resolved = flow(context);
    return isRiseFlow(resolved) ? resolved : "up";
  } catch (error) {
    reportCallbackError(error);
    return "up";
  }
}

export function flowForTransition(
  flow: RiseFlowValue,
  scene: DiffScene,
  from: string,
  to: string,
  dir: MorphDirection,
  rtl: boolean,
): { fallback: RiseFlow; byChunk?: Map<string, RiseFlow> } {
  if (typeof flow !== "function") {
    return { fallback: flow };
  }

  const byChunk = new Map<string, RiseFlow>();
  for (const chunk of scene.chunks) {
    if (chunk.kind === "match") continue;
    const useTarget = chunk.bIndices.length > 0;
    const source = useTarget ? to : from;
    const atoms = useTarget ? scene.atomsB : scene.atomsA;
    const range = atomSourceRange(atoms, useTarget ? chunk.bIndices : chunk.aIndices);
    const text = source.slice(range.start, range.end);
    const length = source.length;
    const position =
      length > 0 ? Math.min(1, Math.max(0, (range.start + range.end) / 2 / length)) : 0;

    const context: RiseFlowContext = {
      from,
      to,
      dir,
      rtl,
      hunk: {
        id: chunk.id,
        kind: chunk.kind === "add" ? "add" : "remove",
        text,
        start: range.start,
        end: range.end,
        length,
        position,
      },
    };
    byChunk.set(chunk.id, resolveFlow(flow, context));
  }

  return { fallback: "up", byChunk };
}
