export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "rtl-text-transform-theme";
const LIGHT_THEME_COLOR = "#f5f5f5";
const DARK_THEME_COLOR = "#0d0d0d";

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

function updateMeta(theme: ResolvedTheme): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  meta?.setAttribute("content", theme === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
}

function paint(preference: ThemePreference): void {
  const theme = resolve(preference);
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.themePreference = preference;
  updateMeta(theme);

  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-theme-choice]")) {
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === preference));
  }

  document.dispatchEvent(new CustomEvent("themechange", { detail: { theme, preference } }));
}

function store(preference: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Ignore storage failures.
  }
}

export function initTheme(): void {
  let preference = getStoredPreference();
  paint(preference);

  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-theme-choice]")) {
    button.addEventListener("click", () => {
      const choice = button.dataset.themeChoice;
      if (choice !== "light" && choice !== "dark" && choice !== "system") return;
      preference = choice;
      store(preference);
      paint(preference);
    });
  }

  systemQuery.addEventListener("change", () => {
    if (preference === "system") paint(preference);
  });
}
