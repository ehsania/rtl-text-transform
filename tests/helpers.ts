import { vi } from "vitest";

export interface FrameClock {
  /** Advance the clock by `ms` and run every scheduled animation frame. */
  step(ms?: number): void;
  /** Run `count` frames of `ms` milliseconds. */
  frames(count: number, ms?: number): void;
  /** Number of frames currently queued (should normally be 0 or 1). */
  pending(): number;
  now(): number;
}

/**
 * Deterministic requestAnimationFrame clock. The controller uses the timestamp
 * passed by rAF, so tests can drive time without fake timers.
 */
export function installFrameClock(): FrameClock {
  let current = 0;
  let nextId = 1;
  const queued = new Map<number, FrameRequestCallback>();

  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextId++;
    queued.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    queued.delete(id);
  });

  return {
    step(ms = 16) {
      current += ms;
      const callbacks = Array.from(queued.values());
      queued.clear();
      for (const callback of callbacks) callback(current);
    },
    frames(count, ms = 100) {
      for (let index = 0; index < count; index += 1) this.step(ms);
    },
    pending() {
      return queued.size;
    },
    now() {
      return current;
    },
  };
}

export function createHost(text = ""): HTMLDivElement {
  const host = document.createElement("div");
  host.style.fontSize = "100px";
  host.textContent = text;
  document.body.append(host);
  return host;
}

export interface LayerView {
  outgoing: HTMLSpanElement;
  incoming: HTMLSpanElement;
  live: HTMLSpanElement;
  outgoingShell: HTMLDivElement;
  incomingShell: HTMLDivElement;
}

export function layers(host: HTMLElement): LayerView {
  const outgoingShell = host.querySelector<HTMLDivElement>('[data-morph-layer="outgoing"]');
  const incomingShell = host.querySelector<HTMLDivElement>('[data-morph-layer="incoming"]');
  const outgoing = host.querySelector<HTMLSpanElement>('[data-morph-line="outgoing"]');
  const incoming = host.querySelector<HTMLSpanElement>('[data-morph-line="incoming"]');
  const live = host.querySelector<HTMLSpanElement>("[data-morph-live]");
  if (!outgoing || !incoming || !live || !outgoingShell || !incomingShell) {
    throw new Error("Morph layers not found");
  }
  return { outgoing, incoming, live, outgoingShell, incomingShell };
}

export type ChunkKind = "match" | "add" | "remove";

/** Chunk spans currently rendered on one line, in reading order. */
export function chunks(line: HTMLSpanElement, kind?: ChunkKind): HTMLSpanElement[] {
  const selector = kind === undefined ? "[data-chunk-id]" : `[data-chunk-kind="${kind}"]`;
  return Array.from(line.querySelectorAll<HTMLSpanElement>(selector));
}
