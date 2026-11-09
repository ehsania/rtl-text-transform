import type { BaseState, Language, Speed } from "../code";
import { baseState, morphOptions } from "../code";
import { createLazyMorph } from "../runtime";
import type { OptionControls } from "../ui";
import { createOptionControls, createStage, h, setHostWeight } from "../ui";
import type { ExampleInstance, ExampleOptions } from "./types";

const MESSAGES: Record<Language, string[]> = {
  fa: ["پیام جدید", "پیام ارسال شد", "اتصال برقرار شد"],
  ar: ["رسالة جديدة", "تم إرسال الرسالة", "تم الاتصال"],
};

export function createToastExample({ controls }: ExampleOptions): ExampleInstance {
  const state: BaseState = baseState({
    mode: "both",
    autoplay: true,
    morphTime: 0.5,
    restTime: 1.9,
    minChunk: 4,
  });

  const stage = createStage();
  const wrap = h("div", "toast-wrap");
  const toast = h("div", "toast");
  toast.dir = "rtl";
  toast.lang = "fa";
  const dot = h("span", "toast-dot");
  dot.setAttribute("aria-hidden", "true");
  const host = h("div", "morph-host toast-morph");
  host.id = "toast-morph";
  host.dir = "rtl";
  host.lang = "fa";
  host.textContent = MESSAGES.fa[0]!;
  toast.append(dot, host);

  const next = h("button", "text-button", "Next message");
  next.type = "button";
  wrap.append(toast, next);
  stage.append(wrap);

  let shared: OptionControls | null = null;

  const lazy = createLazyMorph({
    host,
    stage,
    getOptions: () => morphOptions(state, MESSAGES[state.lang]),
    initialText: MESSAGES[state.lang][0]!,
  });

  next.addEventListener("click", () => {
    void lazy.morph?.next();
  });

  function sync(): void {
    setHostWeight(host, state.weight);
    host.lang = state.lang;
    host.dir = "rtl";
    toast.lang = state.lang;
    lazy.updateOptions();
    shared?.sync();
  }

  if (controls) {
    shared = createOptionControls(state, sync, {
      plain: true,
      includeAutoplay: true,
      includeLoop: true,
      includeEasing: true,
    });
  }

  function setLanguage(lang: Language): void {
    if (lang === state.lang) return;
    state.lang = lang;
    host.lang = lang;
    toast.lang = lang;
    lazy.rebuild(MESSAGES[lang][0]!);
    sync();
  }

  function setSpeed(speed: Speed): void {
    state.speed = speed;
    sync();
  }

  function replay(): void {
    lazy.rebuild(MESSAGES[state.lang][0]!);
    sync();
  }

  function reset(): void {
    Object.assign(
      state,
      baseState({
        mode: "both",
        autoplay: true,
        morphTime: 0.5,
        restTime: 1.9,
        minChunk: 4,
      }),
    );
    host.lang = "fa";
    toast.lang = "fa";
    lazy.rebuild(MESSAGES.fa[0]!);
    sync();
  }

  sync();

  return {
    id: "toast",
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
      lazy.morph?.pause();
    },
    resume() {
      lazy.morph?.play();
    },
    destroy() {
      lazy.destroy();
      shared?.destroy();
    },
  };
}
