import { createMorph } from "rtl-text-transform";
import type { Morph, MorphOptions } from "rtl-text-transform";
import { announce } from "./ui";
import { wait } from "./ui";

export const fontsReady: Promise<void> = (async () => {
  const load = async () => {
    if (!("fonts" in document)) return;
    try {
      await document.fonts.load("800 1em Vazirmatn");
      await document.fonts.ready;
    } catch {
      // A fallback font is still usable.
    }
  };
  await Promise.race([load(), wait(3000)]);
})();

export interface LazyMorph {
  readonly morph: Morph | null;
  updateOptions: () => void;
  rebuild: (text: string) => void;
  ready: () => Promise<Morph | null>;
  destroy: () => void;
}

export interface LazyMorphOptions {
  host: HTMLElement;
  stage: HTMLElement;
  getOptions: () => MorphOptions;
  initialText: string;
  onReady?: (morph: Morph) => void;
}

export function createLazyMorph(options: LazyMorphOptions): LazyMorph {
  let morph: Morph | null = null;
  let visible = false;
  let destroyed = false;
  let pendingText = options.initialText;

  const create = (): void => {
    if (destroyed || morph || !visible) return;
    options.host.textContent = pendingText;
    morph = createMorph(options.host, options.getOptions());
    options.onReady?.(morph);
  };

  const observer =
    typeof IntersectionObserver === "function"
      ? new IntersectionObserver(
          (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
              activate();
            }
          },
          { rootMargin: "320px 0px" },
        )
      : null;

  function activate(): void {
    if (destroyed || visible) return;
    const rect = options.stage.getBoundingClientRect();
    if (rect.top > window.innerHeight + 320 || rect.bottom < -320) return;
    visible = true;
    void fontsReady.then(create);
    observer?.disconnect();
  }

  if (observer) {
    observer.observe(options.stage);
    // Some embedded browsers deliver IntersectionObserver callbacks only on
    // user interaction. A viewport check keeps above-the-fold demos working.
    requestAnimationFrame(activate);
    window.addEventListener("scroll", activate, { passive: true });
    window.addEventListener("resize", activate);
  } else {
    visible = true;
    void fontsReady.then(create);
  }

  return {
    get morph() {
      return morph;
    },
    updateOptions() {
      if (!morph) return;
      morph.update(options.getOptions());
    },
    rebuild(text: string) {
      pendingText = text;
      if (morph) {
        morph.destroy();
        morph = null;
      }
      options.host.textContent = text;
      if (visible) void fontsReady.then(create);
    },
    async ready() {
      await fontsReady;
      if (!morph && visible) create();
      return morph;
    },
    destroy() {
      destroyed = true;
      observer?.disconnect();
      morph?.destroy();
      morph = null;
    },
  };
}

function fallbackCopy(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "-1000px";
  document.body.append(area);
  area.select();
  let ok: boolean;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return fallbackCopy(text);
  }
}

export function initCopyButtons(): void {
  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>("[data-copy]");
    if (!button) return;

    const block = button.closest<HTMLElement>(".code-block");
    const code =
      block?.querySelector<HTMLElement>("code") ??
      block?.querySelector<HTMLElement>("[data-copy-text]");
    const text = code?.textContent ?? "";
    if (!text) return;

    const ok = await copyText(text);
    announce(ok ? "Copied" : "Copy failed");
    if (!ok) return;

    button.textContent = "Copied";
    window.setTimeout(() => {
      button.textContent = "Copy";
    }, 1200);
  });
}

export interface TabOptions {
  root: HTMLElement;
  buttonSelector: string;
  onChange: (value: string) => void;
  initial?: string;
}

export function initTabs(options: TabOptions): void {
  const buttons = Array.from(
    options.root.querySelectorAll<HTMLButtonElement>(options.buttonSelector),
  );
  if (buttons.length === 0) return;

  const select = (button: HTMLButtonElement, focus = false) => {
    for (const item of buttons) {
      const active = item === button;
      item.setAttribute("aria-selected", String(active));
      item.tabIndex = active ? 0 : -1;
    }
    if (focus) button.focus();
    const value = button.dataset.package ?? button.dataset.quickstart ?? button.dataset.value;
    if (value) options.onChange(value);
  };

  const initial =
    buttons.find((button) =>
      options.initial
        ? (button.dataset.package ?? button.dataset.quickstart) === options.initial
        : button.getAttribute("aria-selected") === "true",
    ) ?? buttons[0];

  select(initial);

  for (const [index, button] of buttons.entries()) {
    button.addEventListener("click", () => select(button));
    button.addEventListener("keydown", (event) => {
      let next: number;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        next = (index + 1) % buttons.length;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        next = (index - 1 + buttons.length) % buttons.length;
      } else if (event.key === "Home") {
        next = 0;
      } else if (event.key === "End") {
        next = buttons.length - 1;
      } else {
        return;
      }
      event.preventDefault();
      select(buttons[next]!, true);
    });
  }
}

export function initReducedMotionNote(): void {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  const sync = () => {
    for (const note of document.querySelectorAll<HTMLElement>("[data-reduced-note]")) {
      note.hidden = !query.matches;
    }
  };
  query.addEventListener("change", sync);
  sync();
}
