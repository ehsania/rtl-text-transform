import type { Atom } from "./atoms";
import { isWordBreakAtom } from "./atoms";
import type { DiffOp } from "./diff";

export type ChunkKind = "match" | "add" | "remove";

export interface Chunk {
  id: string;
  kind: ChunkKind;
  /** Atom indices on the outgoing side. Empty for added chunks. */
  aIndices: number[];
  /** Atom indices on the incoming side. Empty for removed chunks. */
  bIndices: number[];
}

export interface ChunkOptions {
  /** Matched runs shorter than this are cross-faded unless they are a word. */
  minChunk?: number;
}

type MatchOp = Extract<DiffOp, { type: "match" }>;

function atWordEdge(atoms: Atom[], start: number, end: number): boolean {
  const before = start === 0 || isWordBreakAtom(atoms[start - 1]!);
  const after = end === atoms.length - 1 || isWordBreakAtom(atoms[end + 1]!);
  return before && after;
}

function isWholeWord(run: MatchOp[], a: Atom[], b: Atom[]): boolean {
  const aStart = run[0]!.aIndex;
  const aEnd = run[run.length - 1]!.aIndex;
  const bStart = run[0]!.bIndex;
  const bEnd = run[run.length - 1]!.bIndex;
  return atWordEdge(a, aStart, aEnd) && atWordEdge(b, bStart, bEnd);
}

/**
 * Turn diff operations into rigid chunks.
 *
 * Only matches that are adjacent in both strings may become chunks. Short
 * scattered matches are downgraded to remove/add pairs; otherwise a single
 * isolated letter would fly across the line while the rest of the word
 * cross-fades around it.
 */
export function diffToChunks(
  a: Atom[],
  b: Atom[],
  operations: DiffOp[],
  options: ChunkOptions = {},
): Chunk[] {
  const minChunk = Math.max(0, Math.floor(options.minChunk ?? 2));
  const chunks: Chunk[] = [];
  let id = 0;

  const push = (kind: ChunkKind, aIndices: number[], bIndices: number[]) => {
    chunks.push({ id: `chunk-${id++}`, kind, aIndices, bIndices });
  };

  let index = 0;
  while (index < operations.length) {
    const operation = operations[index]!;

    if (operation.type === "match") {
      const run: MatchOp[] = [operation];
      let nextIndex = index + 1;
      while (nextIndex < operations.length) {
        const next = operations[nextIndex]!;
        if (next.type !== "match") break;
        const last = run[run.length - 1]!;
        if (next.aIndex !== last.aIndex + 1 || next.bIndex !== last.bIndex + 1) {
          break;
        }
        run.push(next);
        nextIndex += 1;
      }

      if (run.length >= minChunk || isWholeWord(run, a, b)) {
        push(
          "match",
          run.map((match) => match.aIndex),
          run.map((match) => match.bIndex),
        );
      } else {
        for (const match of run) {
          push("remove", [match.aIndex], []);
          push("add", [], [match.bIndex]);
        }
      }
      index = nextIndex;
      continue;
    }

    if (operation.type === "delete") {
      const indices: number[] = [];
      let nextIndex = index;
      while (nextIndex < operations.length) {
        const current = operations[nextIndex]!;
        if (current.type !== "delete") break;
        indices.push(current.aIndex);
        nextIndex += 1;
      }
      push("remove", indices, []);
      index = nextIndex;
      continue;
    }

    const indices: number[] = [];
    let nextIndex = index;
    while (nextIndex < operations.length) {
      const current = operations[nextIndex]!;
      if (current.type !== "insert") break;
      indices.push(current.bIndex);
      nextIndex += 1;
    }
    push("add", [], indices);
    index = nextIndex;
  }

  // A dropped short match produces remove+add; merge adjacent pieces so one
  // span covers the whole changed run and keeps its internal kerning.
  const mergeSide = (kind: "remove" | "add"): Chunk[] => {
    const sideChunks = chunks
      .filter((chunk) => chunk.kind === kind)
      .sort((left, right) => {
        const aIndex = kind === "remove" ? left.aIndices[0] : left.bIndices[0];
        const bIndex = kind === "remove" ? right.aIndices[0] : right.bIndices[0];
        return (aIndex ?? 0) - (bIndex ?? 0);
      });

    const merged: Chunk[] = [];
    for (const chunk of sideChunks) {
      const last = merged[merged.length - 1];
      const lastIndices = last ? (kind === "remove" ? last.aIndices : last.bIndices) : [];
      const indices = kind === "remove" ? chunk.aIndices : chunk.bIndices;
      if (
        last &&
        lastIndices.length > 0 &&
        indices.length > 0 &&
        indices[0] === lastIndices[lastIndices.length - 1]! + 1
      ) {
        if (kind === "remove") last.aIndices.push(...chunk.aIndices);
        else last.bIndices.push(...chunk.bIndices);
      } else {
        merged.push({
          id: "",
          kind,
          aIndices: [...chunk.aIndices],
          bIndices: [...chunk.bIndices],
        });
      }
    }
    return merged;
  };

  const merged = [
    ...mergeSide("remove"),
    ...mergeSide("add"),
    ...chunks.filter((chunk) => chunk.kind === "match"),
  ];

  // Changed text animates as whole hunks. Split after whitespace so no hunk
  // spans two words; ZWNJ is not whitespace, so Persian compounds stay whole.
  const splitChanged = (chunk: Chunk): Chunk[] => {
    if (chunk.kind === "match") return [chunk];

    const indices = chunk.kind === "remove" ? chunk.aIndices : chunk.bIndices;
    const atoms = chunk.kind === "remove" ? a : b;
    const pieces: Chunk[] = [];
    let current: number[] = [];

    const flush = () => {
      if (current.length === 0) return;
      pieces.push({
        id: "",
        kind: chunk.kind,
        aIndices: chunk.kind === "remove" ? current : [],
        bIndices: chunk.kind === "add" ? current : [],
      });
      current = [];
    };

    for (const atomIndex of indices) {
      current.push(atomIndex);
      if (/\s/u.test(atoms[atomIndex]?.text ?? "")) flush();
    }
    flush();

    return pieces.length > 0 ? pieces : [chunk];
  };

  const split = merged.flatMap(splitChanged);
  split.forEach((chunk, chunkIndex) => {
    chunk.id = `chunk-${chunkIndex}`;
  });
  return split;
}
