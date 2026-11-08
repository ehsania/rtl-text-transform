import { visualForFraction } from "./math";

export interface MorphLayer {
  /** Positioning shell. */
  el: HTMLDivElement;
  /** Text line inside the shell. */
  line: HTMLSpanElement;
}

export interface MorphStage {
  outgoing: MorphLayer;
  incoming: MorphLayer;
  live: HTMLSpanElement;
}

const HIDDEN_STYLE = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: "0",
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  "clip-path": "inset(50%)",
  "white-space": "nowrap",
  border: "0",
} as const;

function styleShell(el: HTMLDivElement): void {
  const style = el.style;
  style.position = "absolute";
  style.inset = "0";
  style.display = "flex";
  style.alignItems = "center";
  style.justifyContent = "center";
  style.width = "100%";
  style.height = "100%";
  style.margin = "0";
  style.padding = "0";
  style.pointerEvents = "none";
  style.fontFamily = "inherit";
  style.fontSize = "inherit";
  style.fontWeight = "inherit";
  style.fontStyle = "inherit";
  style.fontStretch = "inherit";
  style.fontVariant = "inherit";
  style.lineHeight = "inherit";
  style.color = "inherit";
  style.textAlign = "center";
  style.overflow = "visible";
}

function styleLine(line: HTMLSpanElement): void {
  const style = line.style;
  style.display = "block";
  style.margin = "0";
  style.padding = "0";
  style.whiteSpace = "nowrap";
  style.direction = "inherit";
  style.textAlign = "center";
  style.userSelect = "none";
  style.webkitUserSelect = "none";
  style.pointerEvents = "none";
  style.transformOrigin = "center center";
  style.opacity = "1";
  style.filter = "none";
  // Positive tracking breaks Arabic joins between letters, so this is forced
  // regardless of host styles.
  style.setProperty("letter-spacing", "0", "important");
}

function createLayer(doc: Document, role: "outgoing" | "incoming"): MorphLayer {
  const el = doc.createElement("div");
  const line = doc.createElement("span");

  el.setAttribute("aria-hidden", "true");
  el.dataset.morphLayer = role;
  styleShell(el);

  line.dataset.morphLine = role;
  styleLine(line);

  el.append(line);
  return { el, line };
}

/**
 * Replace the host's children with two animated layer shells and one live
 * region. The caller is responsible for preserving pre-existing content.
 */
export function createStage(host: HTMLElement): MorphStage {
  const doc = host.ownerDocument;
  const outgoing = createLayer(doc, "outgoing");
  const incoming = createLayer(doc, "incoming");
  const live = doc.createElement("span");

  live.setAttribute("aria-live", "polite");
  live.setAttribute("aria-atomic", "true");
  live.dataset.morphLive = "";
  for (const [name, value] of Object.entries(HIDDEN_STYLE)) {
    live.style.setProperty(name, value);
  }

  host.replaceChildren(outgoing.el, incoming.el, live);
  return { outgoing, incoming, live };
}

function defaultView(host: HTMLElement): Window | null {
  return host.ownerDocument.defaultView;
}

/**
 * Give the host enough room for the filter region and vertical travel without
 * fighting a layout the author configured explicitly.
 */
export function sizeHost(host: HTMLElement): void {
  const view = defaultView(host);
  const computed = view?.getComputedStyle(host);
  const computedPosition = computed?.position ?? "";

  if (!host.style.position && (computedPosition === "" || computedPosition === "static")) {
    host.style.position = "relative";
  }
  if (computed?.display === "inline") {
    // Absolute layers have no in-flow content to give an inline host a width.
    host.style.display = "block";
    if (!host.style.width) host.style.width = "100%";
  }
  const computedMinHeight = computed?.minHeight ?? "";
  if (
    !host.style.minHeight &&
    (!computedMinHeight || computedMinHeight === "0px" || computedMinHeight === "auto")
  ) {
    host.style.minHeight = "1.6em";
  }
}

export function resetLayer(layer: MorphLayer): void {
  layer.line.style.opacity = "1";
  layer.line.style.filter = "none";
  layer.line.style.transform = "none";
}

export function clearLayer(layer: MorphLayer): void {
  layer.line.replaceChildren();
  resetLayer(layer);
}

export function setLayerText(layer: MorphLayer, text: string): void {
  if (
    layer.line.childNodes.length === 1 &&
    layer.line.firstChild?.nodeType === 3 &&
    layer.line.textContent === text
  ) {
    return;
  }
  layer.line.replaceChildren(text);
}

export function applyGooState(
  layer: MorphLayer,
  lightFraction: number,
  fontSizePx: number,
  blurEm: number,
): void {
  const visual = visualForFraction(lightFraction, fontSizePx, blurEm);
  layer.line.style.opacity = String(visual.opacity);
  layer.line.style.filter = visual.blurPx > 0 ? `blur(${visual.blurPx}px)` : "none";
}

export function applyFadeState(layer: MorphLayer, opacity: number): void {
  layer.line.style.opacity = String(Math.max(0, Math.min(1, opacity)));
  layer.line.style.filter = "none";
}

export function setLiveText(el: HTMLSpanElement, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

export function removeStage(stage: MorphStage): void {
  stage.outgoing.el.remove();
  stage.incoming.el.remove();
  stage.live.remove();
}
