import { describe, expect, it } from "vitest";
import {
  DIACRITICS_RE,
  baseAtomText,
  createAtoms,
  isWordBreakAtom,
  segmentGraphemes,
} from "../src/core/atoms";

function atomText(text: string): string[] {
  return createAtoms(text).map((atom) => atom.text);
}

describe("createAtoms", () => {
  it("keeps every UTF-16 code unit of the source", () => {
    const samples = ["سلام", "سلام دنیا", "می‌خواهم", "لا إله إلا الله", "کتاب‌ها", "abc def", ""];
    for (const sample of samples) {
      expect(atomText(sample).join("")).toBe(sample);
      expect(createAtoms(sample).map((atom) => atom.start)[0] ?? 0).toBe(0);
    }
  });

  it("groups a common lam-alef ligature into one atom", () => {
    expect(atomText("لا")).toEqual(["لا"]);
    const atoms = createAtoms("سلام");
    expect(atoms.map((atom) => atom.text)).toEqual(["س", "لا", "م"]);
    expect(atoms[1]!.formKey).toBe("medial,final");
  });

  it("does not group lam-alef across a ZWNJ break", () => {
    const atoms = createAtoms("ل‌ا");
    expect(atoms.map((atom) => atom.text).join("")).toBe("ل‌ا");
    expect(atoms).toHaveLength(2);
    expect(atoms.map((atom) => atom.formKey)).toEqual(["isolated", "isolated"]);
  });

  it("derives contextual forms from neighbouring letters", () => {
    expect(createAtoms("ب").map((atom) => atom.formKey)).toEqual(["isolated"]);
    expect(createAtoms("بب").map((atom) => atom.formKey)).toEqual(["initial", "final"]);
    expect(createAtoms("ببب").map((atom) => atom.formKey)).toEqual(["initial", "medial", "final"]);
  });

  it("treats ZWNJ as a join break and ZWJ as transparent", () => {
    const withZwnj = createAtoms("می‌خواهم");
    const joined = createAtoms("میخواهم");
    const zwnjYeh = withZwnj.find((atom) => atom.text.includes("ی"));
    const joinedYeh = joined.find((atom) => atom.text.includes("ی"));

    expect(zwnjYeh?.text).toContain("\u200C");
    expect(zwnjYeh?.formKey).toBe("final");
    expect(joinedYeh?.formKey).toBe("medial");

    const withZwj = createAtoms("می\u200Dخواهم");
    const zwjYeh = withZwj.find((atom) => atom.text.includes("ی"));
    expect(zwjYeh?.formKey).toBe("medial");
  });

  it("keeps combining marks attached to their base letter", () => {
    const segments = segmentGraphemes("سَلَام");
    expect(segments).toHaveLength(4);
    expect(segments[0]!.segment.length).toBeGreaterThan(1);
    expect(atomText("سَلَام").join("")).toBe("سَلَام");
  });

  it("strips diacritics from a base key without dropping letters", () => {
    const atoms = createAtoms("سَلَام");
    expect(atoms.map(baseAtomText).join("")).toBe("سلام");
    expect("سَلَام".replace(DIACRITICS_RE, "")).toBe("سلام");
  });

  it("marks spaces and punctuation as word breaks but not ZWNJ compounds", () => {
    expect(createAtoms(" ").every(isWordBreakAtom)).toBe(true);
    expect(createAtoms("،").every(isWordBreakAtom)).toBe(true);
    expect(createAtoms("می‌خواهم").some(isWordBreakAtom)).toBe(false);
  });
});
