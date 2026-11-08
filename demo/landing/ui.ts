import type { EasingKey, BaseState, Mode } from "./code";
import { enhanceInlineSlider } from "../inline-slider";

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function createStage(...classes: string[]): HTMLElement {
  return h("div", ["stage", ...classes].join(" "));
}

export interface Segmented<T extends string> {
  el: HTMLElement;
  setValue: (value: T) => void;
}

export function createSegmented<T extends string>(
  label: string,
  options: Array<{ value: T; label: string }>,
  value: T,
  onChange: (value: T) => void,
  className = "",
): Segmented<T> {
  const group = h("div", ["segmented", className].filter(Boolean).join(" "));
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", label);

  const buttons = options.map((option) => {
    const button = h("button", undefined, option.label);
    button.type = "button";
    button.dataset.value = option.value;
    button.setAttribute("aria-pressed", String(option.value === value));
    button.addEventListener("click", () => {
      if (button.getAttribute("aria-pressed") === "true") return;
      setValue(option.value);
      onChange(option.value);
    });
    group.append(button);
    return button;
  });

  function setValue(next: T): void {
    for (const button of buttons) {
      button.setAttribute("aria-pressed", String(button.dataset.value === next));
    }
  }

  return { el: group, setValue };
}

export interface RangeControl {
  el: HTMLElement;
  input: HTMLInputElement;
  setValue: (value: number) => void;
  destroy: () => void;
}

export function createRangeControl(
  label: string,
  min: number,
  max: number,
  step: number,
  value: number,
  format: (value: number) => string,
  onInput: (value: number) => void,
): RangeControl {
  const wrapper = h("label", "control");
  const name = h("span", undefined, label);
  const output = h("output", undefined, format(value));

  const input = h("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);

  wrapper.append(name, output, input);
  const slider = enhanceInlineSlider(wrapper, input, name, output);

  input.addEventListener("input", () => {
    const next = Number(input.value);
    output.textContent = format(next);
    slider.render();
    onInput(next);
  });

  return {
    el: wrapper,
    input,
    setValue(next: number) {
      input.value = String(next);
      output.textContent = format(next);
      slider.render();
    },
    destroy() {
      slider.destroy();
    },
  };
}

function selectShell(select: HTMLSelectElement): HTMLElement {
  const shell = h("span", "select-shell");
  shell.append(select);
  return shell;
}

export interface SelectControl {
  el: HTMLElement;
  select: HTMLSelectElement;
  setValue: (value: string) => void;
}

export function createSelectControl(
  label: string,
  options: Array<{ value: string; label: string }>,
  value: string,
  onChange: (value: string) => void,
): SelectControl {
  const wrapper = h("label", "control");
  wrapper.append(h("span", undefined, label));
  const select = h("select");
  for (const option of options) {
    const node = h("option", undefined, option.label);
    node.value = option.value;
    if (option.value === value) node.selected = true;
    select.append(node);
  }
  select.addEventListener("change", () => onChange(select.value));
  wrapper.append(selectShell(select));
  return {
    el: wrapper,
    select,
    setValue(next: string) {
      select.value = next;
    },
  };
}

export interface SwitchControl {
  el: HTMLButtonElement;
  setValue: (checked: boolean) => void;
}

export function createSwitchControl(
  label: string,
  checked: boolean,
  onChange: (checked: boolean) => void,
): SwitchControl {
  const el = h("button", "switch-control");
  el.type = "button";
  el.setAttribute("role", "switch");
  el.setAttribute("aria-checked", String(checked));
  el.append(h("span", "switch-control__label", label));

  const track = h("span", "switch-control__track");
  track.append(h("span", "switch-control__thumb"));
  el.append(track);

  function setValue(next: boolean): void {
    el.setAttribute("aria-checked", String(next));
  }

  el.addEventListener("click", () => {
    const next = el.getAttribute("aria-checked") !== "true";
    setValue(next);
    onChange(next);
  });

  return { el, setValue };
}

export interface OptionControls {
  el: HTMLElement;
  sync: () => void;
  destroy: () => void;
}

export interface OptionControlFlags {
  restLabel?: string;
  includeMode?: boolean;
  includeAutoplay?: boolean;
  includeLoop?: boolean;
  includeEasing?: boolean;
  includeFlow?: boolean;
  open?: boolean;
  /** Return the control grid directly instead of a collapsible details element. */
  plain?: boolean;
}

export function createOptionControls(
  state: BaseState,
  onChange: () => void,
  flags: OptionControlFlags = {},
): OptionControls {
  const topGrid = h("div", "control-grid control-grid--top");
  const sliderGrid = h("div", "control-grid");
  const toggleGrid = h("div", "toggle-grid");
  const stack = h("div", "control-stack");
  const details = flags.plain ? null : h("details", "advanced");
  if (details) {
    details.open = flags.open === true;
  }

  const syncers: Array<() => void> = [];
  const ranges: RangeControl[] = [];
  const update = (apply: () => void) => {
    apply();
    onChange();
  };

  if (flags.includeMode !== false) {
    const mode = createSelectControl(
      "Mode",
      [
        { value: "goo", label: "Goo" },
        { value: "rise", label: "Rise" },
        { value: "both", label: "Goo + Rise" },
        { value: "fade", label: "Fade" },
      ],
      state.mode,
      (value) => update(() => (state.mode = value as Mode)),
    );
    topGrid.append(mode.el);
    syncers.push(() => mode.setValue(state.mode));
  }

  if (flags.includeEasing) {
    const easing = createSelectControl(
      "Morph easing",
      [
        { value: "easeInOutCubic", label: "Ease in-out (default)" },
        { value: "easeOutCubic", label: "Ease out" },
        { value: "linear", label: "Linear" },
        { value: "cubicBezier", label: "Bezier .65 0 .35 1" },
      ],
      state.easing,
      (value) => update(() => (state.easing = value as EasingKey)),
    );
    topGrid.append(easing.el);
    syncers.push(() => easing.setValue(state.easing));

    const riseEasing = createSelectControl(
      "Rise easing",
      [
        { value: "easeOutCubic", label: "Ease out (default)" },
        { value: "easeInOutCubic", label: "Ease in-out" },
        { value: "linear", label: "Linear" },
        { value: "cubicBezier", label: "Bezier .65 0 .35 1" },
      ],
      state.riseEasing,
      (value) => update(() => (state.riseEasing = value as EasingKey)),
    );
    topGrid.append(riseEasing.el);
    syncers.push(() => riseEasing.setValue(state.riseEasing));
  }

  if (flags.includeFlow !== false) {
    const flow = createSelectControl(
      "Rise flow",
      [
        { value: "up", label: "Up" },
        { value: "down", label: "Down" },
        { value: "left", label: "Left" },
        { value: "right", label: "Right" },
      ],
      state.flow,
      (value) =>
        update(() => {
          state.flow = value as BaseState["flow"];
        }),
    );
    topGrid.append(flow.el);
    syncers.push(() => flow.setValue(state.flow));
  }

  const morphTime = createRangeControl(
    "Morph time",
    0.2,
    3,
    0.05,
    state.morphTime,
    (value) => `${value.toFixed(2)}s`,
    (value) => update(() => (state.morphTime = value)),
  );
  sliderGrid.append(morphTime.el);
  syncers.push(() => morphTime.setValue(state.morphTime));
  ranges.push(morphTime);

  const restTime = createRangeControl(
    flags.restLabel ?? "Rest time",
    0,
    3,
    0.05,
    state.restTime,
    (value) => `${value.toFixed(2)}s`,
    (value) => update(() => (state.restTime = value)),
  );
  sliderGrid.append(restTime.el);
  syncers.push(() => restTime.setValue(state.restTime));
  ranges.push(restTime);

  const gooBlur = createRangeControl(
    "Goo blur",
    0.02,
    0.2,
    0.005,
    state.gooBlur,
    (value) => `${value.toFixed(3)}em`,
    (value) => update(() => (state.gooBlur = value)),
  );
  sliderGrid.append(gooBlur.el);
  syncers.push(() => gooBlur.setValue(state.gooBlur));
  ranges.push(gooBlur);

  const threshold = createRangeControl(
    "Goo threshold",
    60,
    220,
    2,
    state.threshold,
    (value) => String(Math.round(value)),
    (value) => update(() => (state.threshold = value)),
  );
  sliderGrid.append(threshold.el);
  syncers.push(() => threshold.setValue(state.threshold));
  ranges.push(threshold);

  const riseBlur = createRangeControl(
    "Rise blur",
    0,
    0.3,
    0.005,
    state.riseBlur,
    (value) => `${value.toFixed(3)}em`,
    (value) => update(() => (state.riseBlur = value)),
  );
  sliderGrid.append(riseBlur.el);
  syncers.push(() => riseBlur.setValue(state.riseBlur));
  ranges.push(riseBlur);

  const travel = createRangeControl(
    "Rise travel",
    0,
    0.8,
    0.02,
    state.travel,
    (value) => `${value.toFixed(2)}em`,
    (value) => update(() => (state.travel = value)),
  );
  sliderGrid.append(travel.el);
  syncers.push(() => travel.setValue(state.travel));
  ranges.push(travel);

  const scale = createRangeControl(
    "Rise scale",
    0.8,
    1,
    0.01,
    state.scale,
    (value) => value.toFixed(2),
    (value) => update(() => (state.scale = value)),
  );
  sliderGrid.append(scale.el);
  syncers.push(() => scale.setValue(state.scale));
  ranges.push(scale);

  const stagger = createRangeControl(
    "Rise stagger",
    0,
    100,
    5,
    state.stagger,
    (value) => `${Math.round(value)}ms`,
    (value) => update(() => (state.stagger = value)),
  );
  sliderGrid.append(stagger.el);
  syncers.push(() => stagger.setValue(state.stagger));
  ranges.push(stagger);

  const overlap = createRangeControl(
    "Rise overlap",
    0,
    0.8,
    0.05,
    state.overlap,
    (value) => value.toFixed(2),
    (value) => update(() => (state.overlap = value)),
  );
  sliderGrid.append(overlap.el);
  syncers.push(() => overlap.setValue(state.overlap));
  ranges.push(overlap);

  const minChunk = createRangeControl(
    "Min kept run",
    0,
    6,
    1,
    state.minChunk,
    (value) => String(Math.round(value)),
    (value) => update(() => (state.minChunk = value)),
  );
  sliderGrid.append(minChunk.el);
  syncers.push(() => minChunk.setValue(state.minChunk));
  ranges.push(minChunk);

  const weight = createRangeControl(
    "Weight (host)",
    300,
    900,
    50,
    state.weight,
    (value) => String(Math.round(value)),
    (value) => update(() => (state.weight = value)),
  );
  sliderGrid.append(weight.el);
  syncers.push(() => weight.setValue(state.weight));
  ranges.push(weight);

  const atRest = createSwitchControl("Goo filter at rest", state.atRest, (checked) =>
    update(() => (state.atRest = checked)),
  );
  toggleGrid.append(atRest.el);
  syncers.push(() => atRest.setValue(state.atRest));

  const normalize = createSwitchControl("Normalize kaf / yeh", state.normalizeVariants, (checked) =>
    update(() => (state.normalizeVariants = checked)),
  );
  toggleGrid.append(normalize.el);
  syncers.push(() => normalize.setValue(state.normalizeVariants));

  const diacritics = createSwitchControl(
    "Ignore diacritics in diff",
    state.ignoreDiacritics,
    (checked) => update(() => (state.ignoreDiacritics = checked)),
  );
  toggleGrid.append(diacritics.el);
  syncers.push(() => diacritics.setValue(state.ignoreDiacritics));

  if (flags.includeAutoplay) {
    const autoplay = createSwitchControl("Autoplay", state.autoplay, (checked) =>
      update(() => (state.autoplay = checked)),
    );
    toggleGrid.append(autoplay.el);
    syncers.push(() => autoplay.setValue(state.autoplay));
  }

  if (flags.includeLoop) {
    const loop = createSwitchControl("Loop", state.loop, (checked) =>
      update(() => (state.loop = checked)),
    );
    toggleGrid.append(loop.el);
    syncers.push(() => loop.setValue(state.loop));
  }

  for (const section of [topGrid, sliderGrid, toggleGrid]) {
    if (section.childElementCount > 0) stack.append(section);
  }

  if (details) {
    details.append(h("summary", undefined, "Options"), stack);
  }

  return {
    el: details ?? stack,
    sync() {
      for (const sync of syncers) sync();
    },
    destroy() {
      for (const control of ranges) control.destroy();
    },
  };
}

export function announce(message: string): void {
  const region = document.getElementById("live-region");
  if (!region) return;
  region.textContent = "";
  window.setTimeout(() => {
    region.textContent = message;
  }, 30);
}

export function setHostWeight(host: HTMLElement, weight: number): void {
  host.style.fontWeight = String(weight);
}
