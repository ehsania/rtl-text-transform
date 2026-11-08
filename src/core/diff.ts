import type { Atom } from "./atoms";
import { DIACRITICS_RE, ZWNJ } from "./atoms";

export interface DiffOptions {
  /** Treat Arabic kaf/yeh and Persian kaf/yeh as the same letter. */
  normalizeVariants?: boolean;
  /** Do not let combining marks prevent a match. */
  ignoreDiacritics?: boolean;
}

export type DiffOp =
  | { type: "match"; aIndex: number; bIndex: number }
  | { type: "delete"; aIndex: number }
  | { type: "insert"; bIndex: number };

const VARIANT_MAP: Record<string, string> = {
  "\u064A": "\u06CC", // ي -> ی
  "\u0643": "\u06A9", // ك -> ک
};

export function normalizeVariantText(text: string): string {
  return text.replace(/[\u064A\u0643]/g, (char) => VARIANT_MAP[char] ?? char);
}

function normalizedText(atom: Atom, options: DiffOptions): string {
  // ZWNJ is a join control. Its shaping effect is already represented by
  // formKey, so it must not stop two identically shaped letters from matching.
  let text = atom.text.normalize("NFC").split(ZWNJ).join("");
  if (options.normalizeVariants) text = normalizeVariantText(text);
  if (options.ignoreDiacritics) text = text.replace(DIACRITICS_RE, "");
  return text;
}

/**
 * Equality is deliberately layered:
 *   1. identical contextual form plus identical text match;
 *   2. the same form with only an invisible ZWNJ difference also matches;
 *   3. a contextual form change never matches;
 *   4. optional normalization bridges Arabic/Persian variants and marks.
 */
export function atomsEqual(a: Atom, b: Atom, options: DiffOptions = {}): boolean {
  if (a.formKey !== b.formKey) return false;
  return normalizedText(a, options) === normalizedText(b, options);
}

/** Longest-common-subsequence diff over atoms. */
export function diffAtoms(a: Atom[], b: Atom[], options: DiffOptions = {}): DiffOp[] {
  const rows = a.length;
  const columns = b.length;
  const table: Uint32Array[] = Array.from({ length: rows + 1 }, () => new Uint32Array(columns + 1));

  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let column = columns - 1; column >= 0; column -= 1) {
      table[row]![column] = atomsEqual(a[row]!, b[column]!, options)
        ? table[row + 1]![column + 1]! + 1
        : Math.max(table[row + 1]![column]!, table[row]![column + 1]!);
    }
  }

  const operations: DiffOp[] = [];
  let row = 0;
  let column = 0;

  while (row < rows && column < columns) {
    if (atomsEqual(a[row]!, b[column]!, options)) {
      operations.push({ type: "match", aIndex: row, bIndex: column });
      row += 1;
      column += 1;
    } else if (table[row + 1]![column]! >= table[row]![column + 1]!) {
      operations.push({ type: "delete", aIndex: row });
      row += 1;
    } else {
      operations.push({ type: "insert", bIndex: column });
      column += 1;
    }
  }

  while (row < rows) {
    operations.push({ type: "delete", aIndex: row });
    row += 1;
  }
  while (column < columns) {
    operations.push({ type: "insert", bIndex: column });
    column += 1;
  }

  return operations;
}
