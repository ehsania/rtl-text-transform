import { PLAYGROUND_PATH } from "../landing/config";
import type { Language, Speed } from "../landing/code";
import { EXAMPLE_BY_ID, EXAMPLES, isExampleId } from "../landing/examples/registry";
import type { ExampleId, ExampleInstance } from "../landing/examples/types";
import { initShell } from "../landing/shell";
import { createSegmented, h } from "../landing/ui";
import "./playground.css";

function $<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Missing element: ${selector}`);
  return found;
}

interface MountedExample {
  instance: ExampleInstance;
  stageSlot: HTMLElement;
  specificSlot: HTMLElement;
  sharedSlot: HTMLElement;
}

const tabsHost = $<HTMLElement>("[data-example-tabs]");
const description = $<HTMLElement>("[data-example-description]");
const stageHost = $<HTMLElement>("[data-stage-host]");
const specificHost = $<HTMLElement>("[data-specific-host]");
const sharedHost = $<HTMLElement>("[data-shared-host]");
const toolbar = $<HTMLElement>("[data-toolbar]");

const cache = new Map<ExampleId, MountedExample>();
const tabButtons = new Map<ExampleId, HTMLButtonElement>();
let activeId: ExampleId | null = null;

for (const definition of EXAMPLES) {
  const button = h("button", "playground-tab", definition.label);
  button.type = "button";
  button.id = `example-tab-${definition.id}`;
  button.dataset.example = definition.id;
  button.setAttribute("role", "tab");
  button.setAttribute("aria-controls", "playground-panel");
  button.setAttribute("aria-selected", "false");
  button.tabIndex = -1;
  button.addEventListener("click", () => select(definition.id, true));
  tabsHost.append(button);
  tabButtons.set(definition.id, button);
}

function activeExample(): MountedExample | null {
  return activeId ? (cache.get(activeId) ?? null) : null;
}

function mountExample(id: ExampleId): MountedExample {
  const definition = EXAMPLE_BY_ID.get(id);
  if (!definition) throw new Error(`Unknown example: ${id}`);

  const instance = definition.create({ controls: true });

  const stageSlot = h("div", "playground-instance");
  stageSlot.dataset.example = id;
  stageSlot.hidden = true;
  stageSlot.append(instance.stage);
  stageHost.append(stageSlot);

  const specificSlot = h("div", "playground-instance");
  specificSlot.dataset.example = id;
  specificSlot.hidden = true;
  if (instance.specific) {
    specificSlot.append(instance.specific);
  } else if (instance.specificHint) {
    specificSlot.append(h("p", "playground-hint", instance.specificHint));
  }
  specificHost.append(specificSlot);

  const sharedSlot = h("div", "playground-instance");
  sharedSlot.dataset.example = id;
  sharedSlot.hidden = true;
  if (instance.shared) sharedSlot.append(instance.shared);
  sharedHost.append(sharedSlot);

  return { instance, stageSlot, specificSlot, sharedSlot };
}

function showExample(mounted: MountedExample, visible: boolean): void {
  mounted.stageSlot.hidden = !visible;
  mounted.specificSlot.hidden = !visible;
  mounted.sharedSlot.hidden = !visible;
}

function syncToolbar(instance: ExampleInstance): void {
  language.setValue(instance.state.lang);
  speed.setValue(String(instance.state.speed) as "1" | "0.5" | "0.25");
}

function select(id: ExampleId, push: boolean): void {
  if (activeId === id) return;

  const previous = activeExample();
  if (previous) {
    previous.instance.pause();
    showExample(previous, false);
  }

  let next = cache.get(id);
  if (!next) {
    next = mountExample(id);
    cache.set(id, next);
  }

  showExample(next, true);
  specificHost.hidden = next.instance.specific === null && next.instance.specificHint === null;
  next.instance.resume();
  activeId = id;

  for (const [tabId, button] of tabButtons) {
    const active = tabId === id;
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  }

  const activeButton = tabButtons.get(id);
  if (activeButton) stageHost.setAttribute("aria-labelledby", activeButton.id);

  const definition = EXAMPLE_BY_ID.get(id);
  if (definition) description.textContent = definition.description;

  syncToolbar(next.instance);
  window.dispatchEvent(new Event("resize"));

  if (push) {
    history.pushState({ example: id }, "", `${PLAYGROUND_PATH}?example=${id}`);
  }
}

const language = createSegmented<Language>(
  "Language",
  [
    { value: "fa", label: "فارسی" },
    { value: "ar", label: "العربية" },
  ],
  "fa",
  (value) => {
    const current = activeExample();
    if (!current) return;
    current.instance.setLanguage(value);
    syncToolbar(current.instance);
  },
  "segmented--arabic",
);

const speed = createSegmented<"1" | "0.5" | "0.25">(
  "Playback speed",
  [
    { value: "1", label: "1×" },
    { value: "0.5", label: "0.5×" },
    { value: "0.25", label: "0.25×" },
  ],
  "1",
  (value) => {
    const current = activeExample();
    if (!current) return;
    current.instance.setSpeed(Number(value) as Speed);
  },
);

const replayButton = h("button", "control-button", "Replay");
replayButton.type = "button";
replayButton.addEventListener("click", () => {
  const current = activeExample();
  if (!current) return;
  current.instance.replay();
  syncToolbar(current.instance);
});

const resetButton = h("button", "control-button", "Reset");
resetButton.type = "button";
resetButton.addEventListener("click", () => {
  const current = activeExample();
  if (!current) return;
  current.instance.reset();
  syncToolbar(current.instance);
  window.dispatchEvent(new Event("resize"));
});

function toolbarGroup(label: string, control: HTMLElement): HTMLElement {
  const group = h("div", "playground-toolbar-group");
  group.append(h("span", "playground-toolbar-label", label), control);
  return group;
}

const toolbarControls = h("div", "playground-toolbar-controls");
toolbarControls.append(toolbarGroup("Language", language.el), toolbarGroup("Speed", speed.el));

const toolbarActions = h("div", "playground-toolbar-actions");
toolbarActions.append(replayButton, resetButton);
toolbar.append(toolbarControls, toolbarActions);

tabsHost.addEventListener("keydown", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;
  const current = target.dataset.example;
  if (!isExampleId(current)) return;

  const index = EXAMPLES.findIndex((example) => example.id === current);
  if (index < 0) return;

  let next: number;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    next = (index + 1) % EXAMPLES.length;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    next = (index - 1 + EXAMPLES.length) % EXAMPLES.length;
  } else if (event.key === "Home") {
    next = 0;
  } else if (event.key === "End") {
    next = EXAMPLES.length - 1;
  } else {
    return;
  }

  event.preventDefault();
  const nextId = EXAMPLES[next]?.id;
  if (!nextId) return;
  select(nextId, true);
  tabButtons.get(nextId)?.focus();
});

document.addEventListener("visibilitychange", () => {
  const current = activeExample();
  if (!current) return;
  if (document.hidden) current.instance.pause();
  else current.instance.resume();
});

window.addEventListener("popstate", () => {
  const requested = new URLSearchParams(window.location.search).get("example");
  select(isExampleId(requested) ? requested : "words", false);
});

initShell();

const params = new URLSearchParams(window.location.search);
const requested = params.get("example");
const initial: ExampleId = isExampleId(requested) ? requested : "words";
select(initial, false);
window.history.replaceState({ example: initial }, "", `${PLAYGROUND_PATH}?example=${initial}`);
