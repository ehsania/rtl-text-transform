import { GITHUB_URL, NPM_URL } from "./config";
import { hydrateIcons } from "./icons";
import { initReducedMotionNote } from "./runtime";
import { initTheme } from "./theme";

/** Shared page chrome: theme preference, external links and motion note. */
export function initShell(): void {
  hydrateIcons();
  initTheme();

  for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-link="github"]')) {
    link.href = GITHUB_URL;
  }

  for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-link="npm"]')) {
    link.href = NPM_URL;
  }

  initReducedMotionNote();
}
