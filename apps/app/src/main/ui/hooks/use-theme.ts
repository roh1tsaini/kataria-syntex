import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

/** Selectable accents — swatch values must mirror the data-accent blocks in globals.css. */
export const ACCENTS = [
  { id: "claude", label: "Claude", swatch: "oklch(0.66 0.15 41)" },
  { id: "graphite", label: "Graphite", swatch: "oklch(0.22 0.005 260)" },
  { id: "iris", label: "Iris", swatch: "oklch(0.54 0.2 295)" },
  { id: "ocean", label: "Ocean", swatch: "oklch(0.52 0.17 250)" },
  { id: "emerald", label: "Emerald", swatch: "oklch(0.53 0.13 163)" },
  { id: "amber", label: "Amber", swatch: "oklch(0.7 0.15 70)" },
] as const;

export type Accent = (typeof ACCENTS)[number]["id"];

const THEME_KEY = "kataria-challan-theme";
const ACCENT_KEY = "kataria-challan-accent";

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

function readStoredAccent(): Accent {
  try {
    const raw = localStorage.getItem(ACCENT_KEY);
    return ACCENTS.some((a) => a.id === raw) ? (raw as Accent) : "claude";
  } catch {
    return "claude";
  }
}

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

function applyAccent(accent: Accent) {
  document.documentElement.dataset.accent = accent;
}

/** Applies the persisted (or system) theme + accent before first paint (see also /theme-init.js). */
export function initTheme() {
  current = readStoredTheme() ?? systemTheme();
  currentAccent = readStoredAccent();
  apply(current);
  applyAccent(currentAccent);
}

let current: Theme = readStoredTheme() ?? systemTheme();
let currentAccent: Accent = readStoredAccent();

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

export function useAccent() {
  const accent = useSyncExternalStore(
    subscribe,
    () => currentAccent,
    () => currentAccent,
  );

  const setAccent = useCallback((next: Accent) => {
    currentAccent = next;
    try {
      localStorage.setItem(ACCENT_KEY, next);
    } catch {
      // Storage unavailable — accent still applies for this session.
    }
    applyAccent(next);
    emit();
  }, []);

  return { accent, setAccent };
}
