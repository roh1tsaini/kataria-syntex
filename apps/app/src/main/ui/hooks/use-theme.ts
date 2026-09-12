import { useCallback, useSyncExternalStore } from "react";
import { reportThemeBackground } from "@/lib/platform";

export type Theme = "light" | "dark";

const THEME_KEY = "kataria-challan-theme";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readStoredTheme(): Theme | null {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    return raw === "light" || raw === "dark" ? raw : null;
  } catch {
    return null;
  }
}

/** The desktop shell paints the window before this bundle boots; reporting
 *  the resolved background keeps the next launch from flashing the default.
 *  Skipped while the body is still transparent (styles not applied yet). */
function reportBackground(): void {
  const bg = getComputedStyle(document.body).backgroundColor;
  if (bg.startsWith("rgb(")) reportThemeBackground(bg);
}

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  reportBackground();
}

/** Applies the persisted (or system) theme before first paint (see also /theme-init.js). */
export function initTheme() {
  current = readStoredTheme() ?? systemTheme();
  apply(current);
}

let current: Theme = readStoredTheme() ?? systemTheme();

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function emit() {
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      if (readStoredTheme()) return;
      current = e.matches ? "dark" : "light";
      apply(current);
      emit();
    });
}

export function useTheme() {
  const theme = useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );

  const toggleTheme = useCallback(() => {
    const next: Theme = current === "dark" ? "light" : "dark";
    current = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage unavailable (private mode) — theme still applies for this session.
    }
    apply(next);
    emit();
  }, []);

  return { theme, toggleTheme };
}
