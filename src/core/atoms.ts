/**
 * Zero-dependency atomization for Arabic-script text.
 *
 * Atoms are grapheme clusters (a base letter plus its marks) grouped into the
 * units a diff can safely animate. Arabic contextual forms are derived from
 * Unicode joining rules rather than font-specific glyph IDs, which keeps the
 * library dependency-free while preserving joins and ZWNJ.
 */

export interface Atom {
  /** Source slice for this atom, including combining marks. */
  text: string;
  /** Stable identity used for diagnostics and exact equality. */
  key: string;
  /** UTF-16 start offset in the source string. */
  start: number;
  /** UTF-16 end offset in the source string. */
  end: number;
  /** Contextual forms, e.g. "initial,medial,final". */
  formKey: string;
}

const ZWNJ = "\u200C";
const ZWJ = "\u200D";

export const DIACRITICS_RE =
  /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08E1\u08E3-\u08FF]/g;

const ALEF_VARIANTS = new Set([
  "\u0622", // آ
  "\u0623", // أ
  "\u0625", // إ
  "\u0627", // ا
  "\u0671", // ٱ
]);

/** Characters that do not join on their left (next) side. */
const RIGHT_JOINING = new Set(
  [
    "\u0622", // آ
    "\u0623", // أ
    "\u0624", // ؤ
    "\u0625", // إ
    "\u0627", // ا
    "\u0629", // ة
    "\u062F", // د
    "\u0630", // ذ
    "\u0631", // ر
    "\u0632", // ز
    "\u0648", // و
    "\u0698", // ژ
  ].map((char) => char.normalize("NFC")),
);

const NON_JOINING = new Set([
  "\u0621", // ء
]);

export function isMark(char: string): boolean {
  return /^\p{M}$/u.test(char);
}

export function isArabicLetter(char: string): boolean {
  return /\p{L}/u.test(char) && /\p{Script=Arabic}/u.test(char);
}

export function isDiacritic(char: string): boolean {
  return /^[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08E1\u08E3-\u08FF]$/u.test(char);
}

export function canJoinPrevious(char: string): boolean {
  return isArabicLetter(char) && !NON_JOINING.has(char);
}

export function canJoinNext(char: string): boolean {
  return isArabicLetter(char) && !RIGHT_JOINING.has(char) && !NON_JOINING.has(char);
}

interface Neighbor {
  char: string;
  index: number;
}

/**
 * Find the nearest base letter to the right/left. Combining marks and ZWJ are
 * transparent. ZWNJ, whitespace and punctuation break joining.
 */
function neighbor(text: string, index: number, direction: -1 | 1): Neighbor | null {
  let cursor = index + direction;
  while (cursor >= 0 && cursor < text.length) {
    const char = text[cursor];
    if (isMark(char) || char === ZWJ) {
      cursor += direction;
      continue;
    }
    if (char === ZWNJ || /\s/u.test(char) || !isArabicLetter(char)) return null;
    return { char, index: cursor };
  }
  return null;
}

function formOf(text: string, index: number): string {
  const char = text[index];
  if (!isArabicLetter(char)) return "x";

  const previous = neighbor(text, index, -1);
  const next = neighbor(text, index, 1);

  const joinsPrevious = previous !== null && canJoinNext(previous.char) && canJoinPrevious(char);
  const joinsNext = next !== null && canJoinNext(char) && canJoinPrevious(next.char);

  if (joinsPrevious && joinsNext) return "medial";
  if (joinsPrevious) return "final";
  if (joinsNext) return "initial";
  return "isolated";
}

/** Contextual form signature for a source range. */
export function formSignature(text: string, start: number, end: number): string {
  const forms: string[] = [];
  for (let index = start; index < end; index += 1) {
    if (isArabicLetter(text[index])) forms.push(formOf(text, index));
  }
  return forms.length > 0 ? forms.join(",") : "x";
}

interface GraphemeSegment {
  segment: string;
  index: number;
}

type GraphemeSegmenter = {
  segment(input: string): Iterable<GraphemeSegment>;
};

type SegmenterConstructor = new (
  locales?: string | string[],
  options?: { granularity: "grapheme" },
) => GraphemeSegmenter;

let cachedSegmenter: GraphemeSegmenter | null | undefined;

function getSegmenter(): GraphemeSegmenter | null {
  if (cachedSegmenter !== undefined) return cachedSegmenter;
  const intl = Intl as unknown as { Segmenter?: SegmenterConstructor };
  if (typeof intl.Segmenter !== "function") {
    cachedSegmenter = null;
    return cachedSegmenter;
  }
  try {
    cachedSegmenter = new intl.Segmenter(undefined, { granularity: "grapheme" });
  } catch {
    cachedSegmenter = null;
  }
  return cachedSegmenter;
}

/**
 * Fallback grapheme scanner for environments without Intl.Segmenter. It keeps
 * combining marks, variation selectors, emoji modifiers and ZWJ sequences with
 * their base.
 */
function fallbackSegments(text: string): GraphemeSegment[] {
  const segments: GraphemeSegment[] = [];
  let start = 0;
  let current = "";
  let previousWasZWJ = false;

  for (let index = 0; index < text.length;) {
    const codePoint = text.codePointAt(index);
    if (codePoint === undefined) break;
    const char = String.fromCodePoint(codePoint);
    const mark = /^\p{M}$/u.test(char);
    const variation = /^[\uFE00-\uFE0F]$/u.test(char);
    const modifier = /^[\u{1F3FB}-\u{1F3FF}]$/u.test(char);
    const joinControl = char === ZWJ;
    const joinAfter = previousWasZWJ;
    const join = mark || variation || modifier || joinControl || joinAfter;

    if (!join && current.length > 0) {
      segments.push({ segment: current, index: start });
      start = index;
      current = "";
    }
    if (current.length === 0) start = index;
    current += char;
    previousWasZWJ = char === ZWJ;
    index += char.length;
  }

  if (current.length > 0) segments.push({ segment: current, index: start });
  return segments;
}

export function segmentGraphemes(text: string): GraphemeSegment[] {
  if (text.length === 0) return [];
  const segmenter = getSegmenter();
  if (!segmenter) return fallbackSegments(text);
  return Array.from(segmenter.segment(text), (part) => ({
    segment: part.segment,
    index: part.index,
  }));
}

function firstArabicLetter(text: string): string {
  for (const char of text) {
    if (isArabicLetter(char)) return char;
  }
  return "";
}

function isLamSegment(text: string): boolean {
  return firstArabicLetter(text) === "\u0644";
}

function isAlefSegment(text: string): boolean {
  return ALEF_VARIANTS.has(firstArabicLetter(text));
}

/**
 * Group common multi-character Arabic ligatures that must stay in one rendered
 * span. Lam-alef is the important one for Persian and Arabic.
 */
function atomRanges(text: string): Array<{ start: number; end: number }> {
  const segments = segmentGraphemes(text);
  const ranges: Array<{ start: number; end: number }> = [];

  for (let index = 0; index < segments.length; index += 1) {
    const current = segments[index];
    if (!current) continue;
    const next = segments[index + 1];
    // ZWNJ explicitly prevents the lam-alef relationship.
    if (
      next &&
      isLamSegment(current.segment) &&
      !current.segment.includes(ZWNJ) &&
      isAlefSegment(next.segment)
    ) {
      ranges.push({ start: current.index, end: next.index + next.segment.length });
      index += 1;
    } else {
      ranges.push({ start: current.index, end: current.index + current.segment.length });
    }
  }

  return ranges;
}

/** Build atoms from source text. No DOM or font access. */
export function createAtoms(text: string): Atom[] {
  return atomRanges(text).map(({ start, end }) => {
    const atomText = text.slice(start, end);
    const formKey = formSignature(text, start, end);
    return {
      text: atomText,
      key: `${atomText}\u0000${formKey}`,
      start,
      end,
      formKey,
    };
  });
}

/** Glyph-free base key used by normalization: marks removed. */
export function baseAtomText(atom: Atom): string {
  return atom.text.replace(DIACRITICS_RE, "");
}

/** True when an atom is only whitespace/punctuation, not a word character. */
export function isWordBreakAtom(atom: Atom): boolean {
  if (atom.text.includes(ZWNJ) || atom.text.includes(ZWJ)) return false;
  return !/[\p{L}\p{N}]/u.test(atom.text);
}

export { ZWNJ, ZWJ };
