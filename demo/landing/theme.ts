import { createIcon } from "./icons";
import type { IconName } from "./icons";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "rtl-text-transform-theme";
const LIGHT_THEME_COLOR = "#f5f5f5";
const DARK_THEME_COLOR = "#0d0d0d";

const THEME_ORDER: readonly ThemePreference[] = ["system", "light", "dark"];
const ICON_FOR: Record<ThemePreference, IconName> = {
  system: "system",
  light: "sun",
  dark: "moon",
};
const LABEL_FOR: Record<ThemePreference, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

function getStoredPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "light" || value === "dark" || value === "system") {
      return value;
    }
  } catch {
    // Storage can be blocked; system preference still works.
  }
  return "system";
}

const systemQuery = window.matchMedia("(prefers-color-scheme: dark)");

function systemTheme(): ResolvedTheme {
  return systemQuery.matches ? "dark" : "light";
}

function resolve(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? systemTheme() : preference;
}

function nextPreference(preference: ThemePreference): ThemePreference {
  const index = THEME_ORDER.indexOf(preference);
  return THEME_ORDER[(index + 1) % THEME_ORDER.length] ?? "system";
}

function updateMeta(theme: ResolvedTheme): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  meta?.setAttribute("content", theme === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
}

function applyTheme(preference: ThemePreference): void {
  const theme = resolve(preference);
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.themePreference = preference;
  updateMeta(theme);
  document.dispatchEvent(new CustomEvent("themechange", { detail: { theme, preference } }));
}

function store(preference: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Ignore storage failures.
  }
}

interface ThemeIcon {
  setPreference: (preference: ThemePreference) => void;
}

function createThemeIcon(button: HTMLButtonElement): ThemeIcon {
  const icon = document.createElement("span");
  icon.className = "theme-cycle__icon";
  icon.setAttribute("aria-hidden", "true");
  button.replaceChildren(icon);

  function setPreference(preference: ThemePreference): void {
    icon.replaceChildren(createIcon(ICON_FOR[preference], 18));
    const text = `Theme: ${LABEL_FOR[preference]}`;
    button.setAttribute("aria-label", text);
    button.title = text;
  }

  return { setPreference };
}

export function initTheme(): void {
  let preference = getStoredPreference();
  const button = document.querySelector<HTMLButtonElement>("[data-theme-cycle]");
  const icon = button ? createThemeIcon(button) : null;

  applyTheme(preference);
  icon?.setPreference(preference);

  button?.addEventListener("click", () => {
    preference = nextPreference(preference);
    store(preference);
    applyTheme(preference);
    icon?.setPreference(preference);
  });

  systemQuery.addEventListener("change", () => {
    if (preference === "system") applyTheme(preference);
  });
}
