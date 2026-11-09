import type { BaseState, Language, Speed } from "../code";
import { baseState, morphOptions } from "../code";
import { createLazyMorph } from "../runtime";
import type { OptionControls } from "../ui";
import { createOptionControls, createStage, h, setHostWeight } from "../ui";
import type { ExampleInstance, ExampleOptions } from "./types";

const TITLES: Record<Language, string[]> = {
  fa: ["خانه", "جستجو", "علاقه‌مندی‌ها", "تنظیمات"],
  ar: ["الرئيسية", "بحث", "المفضلة", "الإعدادات"],
};

interface AppBarState extends BaseState {
  active: number;
}

export function createTabsExample({ controls }: ExampleOptions): ExampleInstance {
  const state: AppBarState = {
    ...baseState({
      mode: "both",
      autoplay: false,
      morphTime: 0.5,
      restTime: 1.5,
      flow: "down",
    }),
    active: 0,
  };

  const stage = createStage();
  const appbar = h("div", "appbar");
  appbar.dir = "rtl";
  appbar.lang = "fa";
  const top = h("div", "appbar-top");
  const back = h("span", "appbar-side", "‹");
  back.setAttribute("aria-hidden", "true");
  const host = h("div", "morph-host appbar-title");
  host.id = "appbar-morph";
  host.dir = "rtl";
  host.lang = "fa";
  host.tabIndex = 0;
  host.setAttribute("role", "tabpanel");
  host.textContent = TITLES.fa[0]!;
  const action = h("span", "appbar-side", "⋯");
  action.setAttribute("aria-hidden", "true");
  top.append(back, host, action);

  const tabs = h("div", "appbar-tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "App sections");
  const tabButtons: HTMLButtonElement[] = [];

  function renderTabs(): void {
    const titles = TITLES[state.lang];
    for (const [index, title] of titles.entries()) {
      const button = tabButtons[index];
      if (!button) continue;
      button.textContent = title;
      button.setAttribute("aria-selected", String(index === state.active));
      button.tabIndex = index === state.active ? 0 : -1;
    }
    const activeTab = tabButtons[state.active];
    if (activeTab) host.setAttribute("aria-labelledby", activeTab.id);
    tabs.lang = state.lang;
    appbar.lang = state.lang;
  }

  for (let index = 0; index < 4; index += 1) {
    const button = h("button", "appbar-tab");
    button.type = "button";
    button.id = `appbar-tab-${index}`;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", "appbar-morph");
    button.addEventListener("click", () => selectTab(index));
    button.addEventListener("keydown", (event) => {
      let next: number;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        next = (index + 1) % 4;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        next = (index - 1 + 4) % 4;
      } else if (event.key === "Home") {
        next = 0;
      } else if (event.key === "End") {
        next = 3;
      } else {
        return;
      }
      event.preventDefault();
      selectTab(next);
      tabButtons[next]?.focus();
    });
    tabButtons.push(button);
    tabs.append(button);
  }

  appbar.append(top, tabs);
  stage.append(appbar);

  let shared: OptionControls | null = null;

  const lazy = createLazyMorph({
    host,
    stage,
    getOptions: () => ({
      ...morphOptions(state, TITLES[state.lang]),
      onMorphStart: (_from, to) => {
        const index = TITLES[state.lang].indexOf(to);
        if (index >= 0) {
          state.active = index;
          renderTabs();
        }
      },
    }),
    initialText: TITLES.fa[0]!,
    onReady: renderTabs,
  });

  function selectTab(index: number): void {
    state.active = index;
    renderTabs();
    const title = TITLES[state.lang][index];
    if (title) void lazy.morph?.setText(title);
  }

  function sync(): void {
    setHostWeight(host, state.weight);
    host.lang = state.lang;
    host.dir = "rtl";
    appbar.lang = state.lang;
    renderTabs();
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
    state.active = 0;
    host.lang = lang;
    appbar.lang = lang;
    lazy.rebuild(TITLES[lang][0]!);
    sync();
  }

  function setSpeed(speed: Speed): void {
    state.speed = speed;
    sync();
  }

  function replay(): void {
    state.active = 0;
    lazy.rebuild(TITLES[state.lang][0]!);
    renderTabs();
    sync();
  }

  function reset(): void {
    Object.assign(
      state,
      baseState({
        mode: "both",
        autoplay: false,
        morphTime: 0.5,
        restTime: 1.5,
        flow: "down",
      }),
    );
    state.active = 0;
    host.lang = "fa";
    appbar.lang = "fa";
    lazy.rebuild(TITLES.fa[0]!);
    sync();
  }

  renderTabs();
  sync();

  return {
    id: "tabs",
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
