import { describe, expect, it } from "vitest";
import { createAtoms } from "../src/core/atoms";
import { diffToChunks } from "../src/core/chunks";
import { atomsEqual, diffAtoms } from "../src/core/diff";

function chunksOf(from: string, to: string, minChunk = 2) {
  const atomsA = createAtoms(from);
  const atomsB = createAtoms(to);
  const operations = diffAtoms(atomsA, atomsB);
  return { atomsA, atomsB, chunks: diffToChunks(atomsA, atomsB, operations, { minChunk }) };
}

describe("atomsEqual", () => {
  it("matches identical atoms with the same contextual form", () => {
    const [first] = createAtoms("ب");
    const [second] = createAtoms("ب");
    expect(atomsEqual(first!, second!)).toBe(true);
  });

  it("matches an identically shaped letter across a ZWNJ join break", () => {
    const withZwnj = createAtoms("کتاب‌ها");
    const plain = createAtoms("کتاب");
    const zwnjBeh = withZwnj.find((atom) => atom.text.startsWith("ب"))!;
    const plainBeh = plain.find((atom) => atom.text === "ب")!;

    expect(zwnjBeh.text).toBe("ب\u200C");
    expect(zwnjBeh.formKey).toBe("isolated");
    expect(plainBeh.formKey).toBe("isolated");
    expect(atomsEqual(zwnjBeh, plainBeh)).toBe(true);

    const operations = diffAtoms(withZwnj, plain);
    const matchedBeh = operations.find(
      (op) => op.type === "match" && withZwnj[op.aIndex]?.text.startsWith("ب"),
    );
    expect(matchedBeh).toBeDefined();
  });

  it("does not match a letter whose contextual form changes without ZWNJ", () => {
    const joined = createAtoms("کتابها");
    const plain = createAtoms("کتاب");
    const joinedBeh = joined.find((atom) => atom.text === "ب")!;
    const plainBeh = plain.find((atom) => atom.text === "ب")!;

    expect(joinedBeh.formKey).toBe("initial");
    expect(plainBeh.formKey).toBe("isolated");
    expect(atomsEqual(joinedBeh, plainBeh)).toBe(false);
  });

  it("never matches when the contextual form changes", () => {
    const isolated = createAtoms("ب")[0]!;
    const initial = createAtoms("بب")[0]!;
    expect(isolated.formKey).not.toBe(initial.formKey);
    expect(atomsEqual(isolated, initial, { normalizeVariants: true })).toBe(false);
  });

  it("normalizes Arabic/Persian variants and diacritics when asked", () => {
    const arabicYeh = createAtoms("ي")[0]!;
    const persianYeh = createAtoms("ی")[0]!;
    expect(atomsEqual(arabicYeh, persianYeh)).toBe(false);
    expect(atomsEqual(arabicYeh, persianYeh, { normalizeVariants: true })).toBe(true);

    const marked = createAtoms("سَ")[0]!;
    const plain = createAtoms("س")[0]!;
    expect(atomsEqual(marked, plain)).toBe(false);
    expect(atomsEqual(marked, plain, { ignoreDiacritics: true })).toBe(true);
  });
});

describe("diffAtoms", () => {
  it("produces a longest-common-subsequence edit script", () => {
    const a = createAtoms("abcd");
    const b = createAtoms("abXd");
    const operations = diffAtoms(a, b);

    expect(operations.filter((op) => op.type === "match")).toHaveLength(3);
    expect(operations.filter((op) => op.type === "delete")).toHaveLength(1);
    expect(operations.filter((op) => op.type === "insert")).toHaveLength(1);

    const rebuilt = operations
      .filter((op) => op.type !== "delete")
      .map((op) => (op.type === "insert" ? b[op.bIndex] : a[op.aIndex]))
      .map((atom) => atom!.text)
      .join("");
    expect(rebuilt).toBe("abXd");
  });

  it("keeps diacritic-only changes as matches with normalization", () => {
    const a = createAtoms("سَلَام");
    const b = createAtoms("سلام");
    const operations = diffAtoms(a, b, {
      ignoreDiacritics: true,
      normalizeVariants: true,
    });
    expect(operations.every((op) => op.type === "match")).toBe(true);
  });
});

describe("diffToChunks", () => {
  it("keeps matched words rigid and isolates changed hunks", () => {
    const { chunks } = chunksOf("سلام دنیا", "سلام جهان");
    expect(chunks.map((chunk) => chunk.kind).sort()).toEqual(["add", "match", "remove"]);

    const match = chunks.find((chunk) => chunk.kind === "match")!;
    expect(match.aIndices.map((index) => createAtoms("سلام دنیا")[index]!.text).join("")).toBe(
      "سلام ",
    );

    const add = chunks.find((chunk) => chunk.kind === "add")!;
    expect(add.aIndices).toEqual([]);
    expect(add.bIndices.map((index) => createAtoms("سلام جهان")[index]!.text).join("")).toBe(
      "جهان",
    );

    const remove = chunks.find((chunk) => chunk.kind === "remove")!;
    expect(remove.bIndices).toEqual([]);
    expect(remove.aIndices.map((index) => createAtoms("سلام دنیا")[index]!.text).join("")).toBe(
      "دنیا",
    );
  });

  it("downgrades a short isolated match inside a word to changed text", () => {
    const { chunks } = chunksOf("abcd", "abXd");
    const matches = chunks.filter((chunk) => chunk.kind === "match");
    expect(matches).toHaveLength(1);
    expect(matches[0]!.aIndices.map((index) => createAtoms("abcd")[index]!.text).join("")).toBe(
      "ab",
    );

    const changedA = chunks
      .filter((chunk) => chunk.kind === "remove")
      .flatMap((chunk) => chunk.aIndices)
      .map((index) => createAtoms("abcd")[index]!.text)
      .join("");
    expect(changedA).toBe("cd");
  });

  it("keeps a short whole-word match", () => {
    const { chunks } = chunksOf("ب", "ب ج");
    expect(chunks.some((chunk) => chunk.kind === "match")).toBe(true);
  });

  it("splits changed hunks at whitespace but not at ZWNJ", () => {
    const { chunks } = chunksOf("یک", "دو سه", 0);
    const adds = chunks.filter((chunk) => chunk.kind === "add");
    expect(adds).toHaveLength(2);

    const compound = chunksOf("یک", "می‌خواهم", 0);
    expect(compound.chunks.filter((chunk) => chunk.kind === "add")).toHaveLength(1);
  });

  it("honours minChunk when keeping matched runs", () => {
    const { chunks } = chunksOf("abcd", "abXd", 1);
    const matches = chunks.filter((chunk) => chunk.kind === "match");
    expect(matches).toHaveLength(2);
    expect(matches[1]!.aIndices).toEqual([3]);
  });
});
