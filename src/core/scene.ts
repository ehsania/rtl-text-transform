import type { Atom } from "./atoms";
import { canJoinNext, canJoinPrevious, createAtoms, isArabicLetter, isMark, ZWJ } from "./atoms";
import type { Chunk } from "./chunks";
import { diffToChunks } from "./chunks";
import { diffAtoms } from "./diff";
import { resetLayer } from "./layers";
import type { MorphLayer, MorphStage } from "./layers";

export interface ChunkView {
  chunk: Chunk;
  span: HTMLSpanElement;
  text: string;
  sourceStart: number;
  sourceEnd: number;
  side: "a" | "b";
}

export interface MatchedView extends ChunkView {
  /** FLIP offset from the outgoing position to the incoming position. */
  dx: number;
  dy: number;
}

export interface DiffScene {
  from: string;
  to: string;
  atomsA: Atom[];
  atomsB: Atom[];
  chunks: Chunk[];
  enter: ChunkView[];
  exit: ChunkView[];
  matched: MatchedView[];
}

export interface SceneOptions {
  rtl: boolean;
  dir: "rtl" | "ltr" | "auto";
  minChunk: number;
  normalizeVariants: boolean;
  ignoreDiacritics: boolean;
}

function previousBase(text: string, index: number): string {
  let cursor = index - 1;
  while (cursor >= 0 && isMark(text[cursor]!)) cursor -= 1;
  return cursor >= 0 ? text[cursor]! : "";
}

function nextBase(text: string, index: number): string {
  let cursor = index;
  while (cursor < text.length && isMark(text[cursor]!)) cursor += 1;
  return cursor < text.length ? text[cursor]! : "";
}

function firstBaseBetween(text: string, start: number, end: number): string {
  let cursor = start;
  while (cursor < end && isMark(text[cursor]!)) cursor += 1;
  return cursor < end ? text[cursor]! : "";
}

function lastBaseBefore(text: string, end: number): string {
  let cursor = end - 1;
  while (cursor >= 0 && isMark(text[cursor]!)) cursor -= 1;
  return cursor >= 0 ? text[cursor]! : "";
}

function shouldPadStart(text: string, start: number, end: number): boolean {
  if (start <= 0) return false;
  const first = firstBaseBetween(text, start, end);
  const before = previousBase(text, start);
  if (!isArabicLetter(first) || !isArabicLetter(before)) return false;
  return canJoinPrevious(first) && canJoinNext(before);
}

function shouldPadEnd(text: string, start: number, end: number): boolean {
  if (end >= text.length) return false;
  const last = lastBaseBefore(text, end);
  const after = nextBase(text, end);
  if (!isArabicLetter(last) || !isArabicLetter(after)) return false;
  return canJoinNext(last) && canJoinPrevious(after);
}

export function atomSourceRange(atoms: Atom[], indices: number[]): { start: number; end: number } {
  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const index of indices) {
    const atom = atoms[index];
    if (!atom) continue;
    start = Math.min(start, atom.start);
    end = Math.max(end, atom.end);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return { start: 0, end: 0 };
  }
  return { start, end };
}

function styleChunk(span: HTMLSpanElement, dir: SceneOptions["dir"]): void {
  span.dir = dir;
  span.style.display = "inline-block";
  span.style.whiteSpace = "pre";
  span.style.unicodeBidi = "isolate";
  span.style.direction = dir === "auto" ? "inherit" : dir;
  span.style.verticalAlign = "baseline";
  span.style.transformOrigin = "center center";
  span.style.willChange = "transform, opacity, filter";
  span.style.pointerEvents = "none";
  span.style.setProperty("letter-spacing", "0", "important");
}

function renderLayer(
  layer: MorphLayer,
  source: string,
  atoms: Atom[],
  chunks: Chunk[],
  side: "a" | "b",
  options: SceneOptions,
): ChunkView[] {
  resetLayer(layer);
  layer.line.replaceChildren();
  const records: ChunkView[] = [];

  for (const chunk of chunks) {
    const indices = side === "a" ? chunk.aIndices : chunk.bIndices;
    if (indices.length === 0) continue;

    const range = atomSourceRange(atoms, indices);
    if (range.end <= range.start) continue;

    const text = source.slice(range.start, range.end);
    const leadingPad = shouldPadStart(source, range.start, range.end) ? ZWJ : "";
    const trailingPad = shouldPadEnd(source, range.start, range.end) ? ZWJ : "";
    const span = layer.el.ownerDocument.createElement("span");

    span.className = `rtm-chunk rtm-chunk--${chunk.kind}`;
    span.dataset.chunkId = chunk.id;
    span.dataset.chunkKind = chunk.kind;
    span.dataset.chunkSide = side;
    styleChunk(span, options.dir);
    span.textContent = leadingPad + text + trailingPad;

    records.push({
      chunk,
      span,
      text,
      sourceStart: range.start,
      sourceEnd: range.end,
      side,
    });
  }

  records.sort((left, right) => left.sourceStart - right.sourceStart);
  for (const record of records) layer.line.appendChild(record.span);
  return records;
}

/** Use a DOM Range, never the span box, so bearing/overflow is included. */
export function measureSpan(span: HTMLElement): DOMRect {
  const range = span.ownerDocument.createRange();
  range.selectNodeContents(span);
  const rangeRect =
    typeof range.getBoundingClientRect === "function" ? range.getBoundingClientRect() : null;
  const spanRect = span.getBoundingClientRect();
  if (!rangeRect) return spanRect;
  if (
    rangeRect.width === 0 &&
    rangeRect.height === 0 &&
    (spanRect.width > 0 || spanRect.height > 0)
  ) {
    return spanRect;
  }
  return rangeRect;
}

function readingOrder(records: ChunkView[], rtl: boolean): ChunkView[] {
  return records
    .map((record) => {
      const rect = record.span.getBoundingClientRect();
      return { record, x: rtl ? rect.right : rect.left };
    })
    .sort((left, right) => (rtl ? right.x - left.x : left.x - right.x))
    .map((entry) => entry.record);
}

/** Build two shaped layers from a source/target pair. */
export function buildDiffScene(
  stage: MorphStage,
  from: string,
  to: string,
  options: SceneOptions,
): DiffScene {
  const atomsA = createAtoms(from);
  const atomsB = createAtoms(to);
  const operations = diffAtoms(atomsA, atomsB, {
    normalizeVariants: options.normalizeVariants,
    ignoreDiacritics: options.ignoreDiacritics,
  });
  const chunks = diffToChunks(atomsA, atomsB, operations, {
    minChunk: options.minChunk,
  });

  const oldRecords = renderLayer(stage.outgoing, from, atomsA, chunks, "a", options);
  const newRecords = renderLayer(stage.incoming, to, atomsB, chunks, "b", options);

  const oldMatched = new Map<string, ChunkView>();
  for (const record of oldRecords) {
    if (record.chunk.kind === "match") oldMatched.set(record.chunk.id, record);
  }

  const matched: MatchedView[] = [];
  for (const record of newRecords) {
    if (record.chunk.kind !== "match") continue;
    const old = oldMatched.get(record.chunk.id);
    if (!old) continue;

    old.span.style.opacity = "0";
    const oldRect = measureSpan(old.span);
    const newRect = measureSpan(record.span);
    matched.push({
      ...record,
      dx: oldRect.left - newRect.left,
      dy: oldRect.top - newRect.top,
    });
  }

  const enter = newRecords.filter((record) => record.chunk.kind === "add");
  for (const record of enter) record.span.style.opacity = "0";

  const exit = oldRecords.filter((record) => record.chunk.kind === "remove");

  return {
    from,
    to,
    atomsA,
    atomsB,
    chunks,
    enter,
    exit,
    matched,
  };
}

export function enterOrder(scene: DiffScene, rtl: boolean): ChunkView[] {
  return readingOrder(scene.enter, rtl);
}

export function exitOrder(scene: DiffScene, rtl: boolean): ChunkView[] {
  return readingOrder(scene.exit, rtl);
}
