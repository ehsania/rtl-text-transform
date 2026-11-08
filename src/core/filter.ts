import { thresholdMatrix } from "./math";

const SVG_NS = "http://www.w3.org/2000/svg";

export interface GooFilterHandle {
  readonly id: string;
  readonly threshold: number;
  /** Decrement the reference count and remove the SVG when it reaches zero. */
  release(): void;
}

interface FilterEntry {
  id: string;
  threshold: number;
  svg: SVGSVGElement;
  refs: number;
}

/**
 * Each document gets its own registry so iframes and multiple documents do not
 * share SVG nodes. IDs are globally unique within the module.
 */
const registries = new WeakMap<Document, Map<number, FilterEntry>>();
let idCounter = 0;

function normalizeThreshold(threshold: number): number {
  if (!Number.isFinite(threshold)) return 140;
  return Math.max(0, Math.min(255, Math.round(threshold)));
}

function registryFor(doc: Document): Map<number, FilterEntry> {
  let registry = registries.get(doc);
  if (!registry) {
    registry = new Map();
    registries.set(doc, registry);
  }
  return registry;
}

function setStyles(el: SVGElement, styles: Record<string, string>): void {
  for (const [name, value] of Object.entries(styles)) {
    el.style.setProperty(name, value);
  }
}

function createFilterSvg(doc: Document, threshold: number): FilterEntry {
  const id = `goo-morph-${++idCounter}`;
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  setStyles(svg, {
    position: "absolute",
    width: "0",
    height: "0",
    overflow: "hidden",
    "pointer-events": "none",
  });

  const defs = doc.createElementNS(SVG_NS, "defs");
  const filter = doc.createElementNS(SVG_NS, "filter");
  filter.setAttribute("id", id);
  // Be generous with the filter region: Arabic dots, ascenders and descenders
  // sit well outside the em box at heavy weights.
  filter.setAttribute("x", "-25%");
  filter.setAttribute("y", "-35%");
  filter.setAttribute("width", "150%");
  filter.setAttribute("height", "170%");
  filter.setAttribute("color-interpolation-filters", "sRGB");

  const matrix = doc.createElementNS(SVG_NS, "feColorMatrix");
  matrix.setAttribute("in", "SourceGraphic");
  matrix.setAttribute("type", "matrix");
  matrix.setAttribute("values", thresholdMatrix(threshold));

  filter.appendChild(matrix);
  defs.appendChild(filter);
  svg.appendChild(defs);
  (doc.body ?? doc.documentElement).appendChild(svg);

  return { id, threshold, svg, refs: 0 };
}

/**
 * Acquire a shared SVG filter for a threshold. The filter is created lazily,
 * kept while at least one morph uses it, and removed when the last handle is
 * released.
 */
export function acquireGooFilter(
  threshold: number,
  doc: Document | undefined = typeof document === "undefined" ? undefined : document,
): GooFilterHandle | null {
  if (!doc) return null;

  const normalized = normalizeThreshold(threshold);
  const registry = registryFor(doc);
  let entry = registry.get(normalized);
  if (!entry || !entry.svg.isConnected) {
    if (entry) registry.delete(normalized);
    entry = createFilterSvg(doc, normalized);
    registry.set(normalized, entry);
  }

  entry.refs += 1;
  let released = false;

  return {
    id: entry.id,
    threshold: normalized,
    release() {
      if (released) return;
      released = true;

      const current = registry.get(normalized);
      if (!current || current !== entry) return;
      current.refs = Math.max(0, current.refs - 1);
      if (current.refs === 0) {
        current.svg.remove();
        registry.delete(normalized);
      }
    },
  };
}

/** Current reference count for a threshold. Primarily useful in tests. */
export function getFilterRefCount(
  threshold: number,
  doc: Document | undefined = typeof document === "undefined" ? undefined : document,
): number {
  if (!doc) return 0;
  return registryFor(doc).get(normalizeThreshold(threshold))?.refs ?? 0;
}

/** Current filter element for a threshold, or null. Primarily useful in tests. */
export function getFilterElement(
  threshold: number,
  doc: Document | undefined = typeof document === "undefined" ? undefined : document,
): SVGFilterElement | null {
  if (!doc) return null;
  return registryFor(doc).get(normalizeThreshold(threshold))?.svg.querySelector("filter") ?? null;
}
