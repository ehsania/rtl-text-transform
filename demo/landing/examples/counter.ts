import { resolvePreset } from "rtl-text-transform";
import type { BaseState, Language, Speed } from "../code";
import { baseState, EASING_FUNCTIONS, effectiveTimings } from "../code";
import { createLazyMorph } from "../runtime";
import type { OptionControls } from "../ui";
import { createOptionControls, createStage, h, setHostWeight, wait } from "../ui";
import type { ExampleInstance, ExampleOptions } from "./types";

interface CounterState extends BaseState {
  count: number;
}

const LOCALES = { fa: "fa-IR", ar: "ar-EG" } as const;

function phrase(lang: Language, count: number): string {
  const number = new Intl.NumberFormat(LOCALES[lang], {
    useGrouping: false,
  }).format(count);
  return lang === "fa" ? `${number} مورد در سبد` : `${number} عناصر في السلة`;
}

function counterIcon(kind: "plus" | "minus"): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", kind === "plus" ? "M8 3v10M3 8h10" : "M3 8h10");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.5");
  path.setAttribute("stroke-linecap", "round");
  svg.append(path);
  return svg;
}

export function createCounterExample({ controls }: ExampleOptions): ExampleInstance {
  const state: CounterState = {
    ...baseState({
      mode: "rise",
      autoplay: false,
      morphTime: 0.5,
      restTime: 1.4,
      riseBlur: 0.05,
      scale: 0.8,
      overlap: 0,
    }),
    count: 3,
  };

  const stage = createStage();
  const demo = h("div", "counter-demo");
  demo.dir = "rtl";
  const minus = h("button", "counter-button");
  minus.type = "button";
  minus.setAttribute("aria-label", "Decrease count");
  minus.append(counterIcon("minus"));
  const host = h("div", "morph-host counter-morph");
  host.id = "counter-morph";
  host.dir = "rtl";
  host.lang = "fa";
  host.textContent = phrase("fa", state.count);
  const plus = h("button", "counter-button");
  plus.type = "button";
  plus.setAttribute("aria-label", "Increase count");
  plus.append(counterIcon("plus"));
  demo.append(minus, host, plus);
  stage.append(demo);

  let shared: OptionControls | null = null;
  let replayToken = 0;

  const lazy = createLazyMorph({
    host,
    stage,
    getOptions: () => {
      const timings = effectiveTimings(state);
      const gooOn = state.mode === "goo" || state.mode === "both";
      const riseOn = state.mode === "rise" || state.mode === "both";
      return resolvePreset("numbers", {
        motion: "default",
        words: words(),
        dir: "rtl",
        lang: state.lang,
        autoplay: state.autoplay,
        loop: state.loop,
        morphTime: timings.morphTime,
        restTime: timings.restTime,
        easing: EASING_FUNCTIONS[state.easing],
        effects: {
          goo: gooOn
            ? {
                blur: state.gooBlur,
                threshold: state.threshold,
                atRest: state.atRest,
              }
            : false,
          rise: riseOn
            ? {
                blur: state.riseBlur,
                travel: state.travel,
                scale: state.scale,
                stagger: state.stagger,
                overlap: state.overlap,
                minChunk: state.minChunk,
                normalizeVariants: state.normalizeVariants,
                ignoreDiacritics: state.ignoreDiacritics,
                easing: EASING_FUNCTIONS[state.riseEasing],
              }
            : false,
        },
      });
    },
    initialText: phrase(state.lang, state.count),
    onReady: () => syncButtons(),
  });

  function words(): string[] {
    return [phrase(state.lang, state.count), phrase(state.lang, state.count + 1)];
  }

  function syncButtons(): void {
    minus.disabled = state.count <= 0;
    plus.disabled = state.count >= 9;
  }

  function sync(): void {
    setHostWeight(host, state.weight);
    host.lang = state.lang;
    lazy.updateOptions();
    shared?.sync();
    syncButtons();
  }

  function setCount(next: number): void {
    state.count = Math.max(0, Math.min(9, next));
    sync();
    void lazy.morph?.setText(phrase(state.lang, state.count));
  }

  minus.addEventListener("click", () => setCount(state.count - 1));
  plus.addEventListener("click", () => setCount(state.count + 1));

  if (controls) {
    shared = createOptionControls(state, sync, {
      plain: true,
      includeAutoplay: true,
      includeLoop: true,
      includeFlow: false,
      includeEasing: true,
    });
  }

  function setLanguage(lang: Language): void {
    if (lang === state.lang) return;
    replayToken += 1;
    state.lang = lang;
    host.lang = lang;
    lazy.rebuild(phrase(lang, state.count));
    sync();
  }

  function setSpeed(speed: Speed): void {
    state.speed = speed;
    sync();
  }

  function replay(): void {
    replayToken += 1;
    const token = replayToken;
    state.count = 3;
    lazy.rebuild(phrase(state.lang, 3));
    sync();
    void (async () => {
      const morph = await lazy.ready();
      if (!morph || token !== replayToken) return;
      await wait(effectiveTimings(state).restTime * 1000);
      if (token !== replayToken) return;
      state.count = 4;
      sync();
      await morph.setText(phrase(state.lang, 4));
    })();
  }

  function reset(): void {
    replayToken += 1;
    Object.assign(
      state,
      baseState({
        mode: "rise",
        autoplay: false,
        morphTime: 0.5,
        restTime: 1.4,
        riseBlur: 0.05,
        scale: 0.8,
        overlap: 0,
      }),
    );
    state.count = 3;
    host.lang = "fa";
    lazy.rebuild(phrase("fa", 3));
    sync();
  }

  return {
    id: "counter",
    stage,
    specific: null,
    specificHint: null,
    shared: shared?.el ?? null,
    state,
    setLanguage,
    setSpeed,
    replay,
    reset,
    pause() {
      replayToken += 1;
      lazy.morph?.pause();
    },
    resume() {
      if (state.autoplay) lazy.morph?.play();
    },
    destroy() {
      replayToken += 1;
      lazy.destroy();
      shared?.destroy();
    },
  };
}
