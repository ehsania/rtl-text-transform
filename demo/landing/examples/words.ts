import type { MotionName } from "rtl-text-transform";
import { resolvePreset } from "rtl-text-transform";
import type { BaseState, Language, Speed } from "../code";
import { baseState, EASING_FUNCTIONS, effectiveTimings } from "../code";
import { createLazyMorph } from "../runtime";
import type { OptionControls, SelectControl } from "../ui";
import { createOptionControls, createSelectControl, createStage, h } from "../ui";
import type { ExampleInstance, ExampleOptions } from "./types";

const WORDS: Record<Language, string[]> = {
  fa: ["کوالا", "کوکاکولا", "لالیگا", "یوزپلنگ", "لدزپلین", "پلی‌استیشن"],
  ar: [
    "أهلاً وسهلاً",
    "أهلاً بكم",
    "مرحباً بكم",
    "مرحباً بالعالم",
    "مرحبا بالعالم",
    "أهلاً بالعالم",
  ],
};

export function createWordsExample({ controls }: ExampleOptions): ExampleInstance {
  const state: BaseState = baseState({
    mode: "both",
    autoplay: true,
    morphTime: 0.7,
    stagger: 0,
    minChunk: 0,
  });
  let motion: MotionName = "default";
  let words = [...WORDS[state.lang]];
  let editTimer = 0;

  const stage = createStage();
  const host = h("div", "morph-host words-morph");
  host.dir = "rtl";
  host.lang = state.lang;
  host.textContent = words[0]!;
  stage.append(host);

  const lazy = createLazyMorph({
    host,
    stage,
    getOptions: () => options(),
    initialText: words[0]!,
  });

  let shared: OptionControls | null = null;
  let motionControl: SelectControl | null = null;
  let editorInput: HTMLInputElement | null = null;

  function options() {
    const timings = effectiveTimings(state);
    const gooOn = state.mode === "goo" || state.mode === "both";
    const riseOn = state.mode === "rise" || state.mode === "both";
    return resolvePreset("wordsHorizontal", {
      motion,
      words,
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
  }

  function sync(): void {
    host.style.fontWeight = String(state.weight);
    host.lang = state.lang;
    lazy.updateOptions();
    shared?.sync();
    motionControl?.setValue(motion);
  }

  function syncSpecific(): void {
    motionControl?.setValue(motion);
    if (editorInput) {
      editorInput.value = words.join(", ");
      editorInput.lang = state.lang;
      editorInput.placeholder = WORDS[state.lang].join(", ");
    }
  }

  let specific: HTMLElement | null = null;

  if (controls) {
    specific = h("div", "control-grid");

    const editor = h("label", "control control--wide word-editor");
    editor.append(h("span", undefined, "Words, separated by commas or ،"));
    const input = h("input");
    input.type = "text";
    input.dir = "rtl";
    input.lang = state.lang;
    input.spellcheck = false;
    input.autocomplete = "off";
    input.value = words.join(", ");
    input.placeholder = WORDS[state.lang].join(", ");
    editorInput = input;

    function commitWords(): void {
      const next = [
        ...new Set(
          input.value
            .split(/[,،]/)
            .map((word) => word.trim())
            .filter(Boolean),
        ),
      ].slice(0, 12);
      if (next.length === 0) return;
      words = next;
      lazy.updateOptions();
      const live = host.querySelector<HTMLElement>("[data-morph-live]")?.textContent ?? "";
      if (!words.includes(live)) void lazy.morph?.setText(words[0]!);
    }

    input.addEventListener("input", () => {
      window.clearTimeout(editTimer);
      editTimer = window.setTimeout(commitWords, 240);
    });
    input.addEventListener("change", () => {
      window.clearTimeout(editTimer);
      commitWords();
      input.value = words.join(", ");
    });
    editor.append(input);
    specific.append(editor);

    motionControl = createSelectControl(
      "Motion preset",
      [
        { value: "default", label: "Default" },
        { value: "smooth", label: "Smooth" },
        { value: "snappy", label: "Snappy" },
        { value: "gentle", label: "Gentle" },
      ],
      motion,
      (value) => {
        motion = value as MotionName;
        const resolved = resolvePreset("wordsHorizontal", { motion });
        if (typeof resolved.morphTime === "number") {
          state.morphTime = resolved.morphTime;
        }
        const rise = resolved.effects?.rise;
        if (rise && typeof rise === "object") {
          if (typeof rise.stagger === "number") state.stagger = rise.stagger;
          if (typeof rise.overlap === "number") state.overlap = rise.overlap;
        }
        lazy.rebuild(words[0]!);
        sync();
      },
    );
    specific.append(motionControl.el);

    shared = createOptionControls(state, sync, {
      plain: true,
      includeFlow: false,
      includeAutoplay: true,
      includeLoop: true,
      includeEasing: true,
    });
  }

  function setLanguage(lang: Language): void {
    if (lang === state.lang) return;
    state.lang = lang;
    words = [...WORDS[lang]];
    host.lang = lang;
    syncSpecific();
    lazy.rebuild(words[0]!);
    sync();
  }

  function setSpeed(speed: Speed): void {
    state.speed = speed;
    sync();
  }

  function replay(): void {
    lazy.rebuild(words[0]!);
    sync();
  }

  function reset(): void {
    Object.assign(
      state,
      baseState({
        mode: "both",
        autoplay: true,
        morphTime: 0.7,
        stagger: 0,
        minChunk: 0,
      }),
    );
    motion = "default";
    words = [...WORDS.fa];
    host.lang = "fa";
    syncSpecific();
    lazy.rebuild(words[0]!);
    sync();
  }

  return {
    id: "words",
    stage,
    specific,
    specificHint: null,
    shared: shared?.el ?? null,
    state,
    setLanguage,
    setSpeed,
    replay,
    reset,
    pause() {
      window.clearTimeout(editTimer);
      lazy.morph?.pause();
    },
    resume() {
      if (state.autoplay) lazy.morph?.play();
    },
    destroy() {
      window.clearTimeout(editTimer);
      lazy.destroy();
      shared?.destroy();
    },
  };
}
