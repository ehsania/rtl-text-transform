import type { BaseState, Language, Speed } from "../code";
import { baseState, effectiveTimings, morphOptions } from "../code";
import { createLazyMorph, fontsReady } from "../runtime";
import type { OptionControls, Segmented } from "../ui";
import { createOptionControls, createSegmented, createStage, h, setHostWeight, wait } from "../ui";
import type { ExampleInstance, ExampleOptions } from "./types";

interface Labels {
  idle: string;
  loading: string;
  done: string;
}

interface ButtonState extends BaseState {
  labels: Labels;
  spinner: "start" | "end";
  phase: "idle" | "loading" | "done";
}

const DEFAULT_LABELS: Record<Language, Labels> = {
  fa: {
    idle: "پردازش",
    loading: "در حال پردازش...",
    done: "انجام شد",
  },
  ar: {
    idle: "معالجة",
    loading: "جارٍ المعالجة...",
    done: "تم",
  },
};

function checkIcon(): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "button-check");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", "M2.8 8.5l3.3 3.3L13.3 4.7");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  return svg;
}

function labelField(
  label: string,
  initial: string,
  onInput: (value: string) => void,
): { el: HTMLElement; input: HTMLInputElement } {
  const wrapper = h("label", "control");
  wrapper.append(h("span", undefined, label));
  const input = h("input");
  input.type = "text";
  input.dir = "rtl";
  input.value = initial;
  input.maxLength = 24;
  input.spellcheck = false;
  input.addEventListener("input", () => onInput(input.value));
  wrapper.append(input);
  return { el: wrapper, input };
}

export function createButtonExample({ controls }: ExampleOptions): ExampleInstance {
  const state: ButtonState = {
    ...baseState({
      mode: "both",
      autoplay: false,
      morphTime: 0.6,
      restTime: 1.4,
      weight: 800,
    }),
    labels: { ...DEFAULT_LABELS.fa },
    spinner: "end",
    phase: "idle",
  };

  const stage = createStage("stage--button");
  const demo = h("div", "button-demo");
  const button = h("button", "demo-button");
  button.type = "button";
  button.dir = "rtl";
  button.setAttribute("aria-busy", "false");
  button.dataset.state = "idle";
  button.dataset.spinner = state.spinner;

  const spinner = h("span", "button-spinner");
  spinner.setAttribute("aria-hidden", "true");
  const host = h("span", "morph-host button-label");
  host.id = "button-morph";
  host.dir = "rtl";
  host.lang = "fa";
  host.textContent = state.labels.idle;
  host.style.display = "block";
  host.style.fontWeight = String(state.weight);
  host.style.minHeight = "1.4em";

  const check = checkIcon();
  button.append(spinner, host, check);
  demo.append(button);
  stage.append(demo);
  const measure = h("span", "button-measure");
  measure.setAttribute("aria-hidden", "true");
  stage.append(measure);

  let busy = false;
  let sequence = 0;
  let replayTimer = 0;
  let destroyed = false;

  let shared: OptionControls | null = null;
  let spinnerControl: Segmented<"start" | "end"> | null = null;
  let idleInput: HTMLInputElement | null = null;
  let loadingInput: HTMLInputElement | null = null;
  let doneInput: HTMLInputElement | null = null;

  const lazy = createLazyMorph({
    host,
    stage,
    getOptions: () => morphOptions(state, words()),
    initialText: state.labels.idle,
    onReady: () => {
      measureWidth();
    },
  });

  function words(): string[] {
    return [state.labels.idle, state.labels.loading, state.labels.done];
  }

  function measureWidth(): void {
    if (destroyed) return;
    measure.style.fontWeight = String(state.weight);
    measure.textContent = state.labels[state.phase];
    const labelWidth = Math.max(1, Math.ceil(measure.getBoundingClientRect().width));
    host.style.width = `${labelWidth}px`;
    host.style.fontWeight = String(state.weight);
    const iconCount = state.phase === "idle" ? 0 : 1;
    const width = labelWidth + 36 + iconCount * 24 + 2;
    button.style.width = `${Math.ceil(width)}px`;
  }

  function setPhase(phase: ButtonState["phase"]): void {
    state.phase = phase;
    button.dataset.state = phase;
    button.dataset.spinner = state.spinner;
    button.setAttribute("aria-busy", String(phase === "loading"));
    measureWidth();
  }

  function sync(): void {
    setHostWeight(host, state.weight);
    button.lang = state.lang;
    button.setAttribute("aria-busy", String(state.phase === "loading"));
    measureWidth();
    lazy.updateOptions();
    shared?.sync();
    syncLabelInputs();
    spinnerControl?.setValue(state.spinner);
  }

  function syncLabelInputs(): void {
    if (idleInput) idleInput.value = state.labels.idle;
    if (loadingInput) loadingInput.value = state.labels.loading;
    if (doneInput) doneInput.value = state.labels.done;
  }

  async function runSequence(): Promise<void> {
    if (busy || destroyed) return;
    busy = true;
    const token = ++sequence;
    const morph = await lazy.ready();
    if (!morph || token !== sequence || destroyed) {
      busy = false;
      return;
    }

    setPhase("loading");
    await morph.next();
    if (token !== sequence || destroyed) return;
    await wait(effectiveTimings(state).restTime * 1000);
    if (token !== sequence || destroyed) return;
    setPhase("done");
    await morph.next();
    if (token !== sequence || destroyed) return;
    await wait(effectiveTimings(state).restTime * 1000);
    if (token !== sequence || destroyed) return;
    setPhase("idle");
    await morph.next();
    if (token !== sequence || destroyed) return;
    busy = false;
  }

  button.addEventListener("click", () => {
    if (busy) return;
    void runSequence();
  });

  function labelsChanged(): void {
    lazy.updateOptions();
    if (state.phase === "idle") {
      lazy.morph?.setText(state.labels.idle);
    }
    measureWidth();
  }

  let specific: HTMLElement | null = null;

  if (controls) {
    specific = h("div", "control-grid");

    const idleField = labelField("Idle label", state.labels.idle, (value) => {
      state.labels.idle = value;
      labelsChanged();
    });
    const loadingField = labelField("Loading label", state.labels.loading, (value) => {
      state.labels.loading = value;
      labelsChanged();
    });
    const doneField = labelField("Done label", state.labels.done, (value) => {
      state.labels.done = value;
      labelsChanged();
    });
    idleInput = idleField.input;
    loadingInput = loadingField.input;
    doneInput = doneField.input;
    specific.append(idleField.el, loadingField.el, doneField.el);

    spinnerControl = createSegmented(
      "Spinner position",
      [
        { value: "start", label: "Start" },
        { value: "end", label: "End" },
      ],
      state.spinner,
      (value) => {
        state.spinner = value as "start" | "end";
        button.dataset.spinner = state.spinner;
        measureWidth();
      },
    );

    const spinnerWrap = h("div", "control");
    spinnerWrap.append(h("span", undefined, "Spinner position"), spinnerControl.el);
    specific.append(spinnerWrap);

    shared = createOptionControls(state, sync, {
      plain: true,
      restLabel: "Task / hold time",
      includeAutoplay: false,
      includeLoop: false,
      includeEasing: true,
    });
  }

  function setLanguage(lang: Language): void {
    sequence += 1;
    busy = false;
    window.clearTimeout(replayTimer);
    state.lang = lang;
    state.labels = { ...DEFAULT_LABELS[lang] };
    state.phase = "idle";
    button.dataset.state = "idle";
    host.lang = lang;
    if (idleInput) idleInput.value = state.labels.idle;
    if (loadingInput) loadingInput.value = state.labels.loading;
    if (doneInput) doneInput.value = state.labels.done;
    lazy.rebuild(state.labels.idle);
    sync();
  }

  function setSpeed(speed: Speed): void {
    state.speed = speed;
    sync();
  }

  function replay(): void {
    sequence += 1;
    busy = false;
    window.clearTimeout(replayTimer);
    state.phase = "idle";
    button.dataset.state = "idle";
    lazy.rebuild(state.labels.idle);
    sync();
    replayTimer = window.setTimeout(() => {
      void runSequence();
    }, 120);
  }

  function reset(): void {
    sequence += 1;
    busy = false;
    window.clearTimeout(replayTimer);
    Object.assign(
      state,
      baseState({
        mode: "both",
        autoplay: false,
        morphTime: 0.6,
        restTime: 1.4,
        weight: 800,
      }),
    );
    state.labels = { ...DEFAULT_LABELS.fa };
    state.spinner = "end";
    state.phase = "idle";
    button.dataset.state = "idle";
    host.lang = "fa";
    lazy.rebuild(state.labels.idle);
    sync();
  }

  function pause(): void {
    sequence += 1;
    busy = false;
    window.clearTimeout(replayTimer);
    if (state.phase !== "idle") {
      setPhase("idle");
      lazy.rebuild(state.labels.idle);
    } else {
      lazy.morph?.pause();
    }
  }

  fontsReady.then(() => {
    measureWidth();
  });
  window.addEventListener("resize", measureWidth);
  document.addEventListener("themechange", measureWidth);

  sync();

  return {
    id: "button",
    stage,
    specific,
    specificHint: null,
    shared: shared?.el ?? null,
    state,
    setLanguage,
    setSpeed,
    replay,
    reset,
    pause,
    resume() {
      lazy.morph?.play();
    },
    destroy() {
      destroyed = true;
      sequence += 1;
      busy = false;
      window.clearTimeout(replayTimer);
      window.removeEventListener("resize", measureWidth);
      document.removeEventListener("themechange", measureWidth);
      lazy.destroy();
      shared?.destroy();
    },
  };
}
