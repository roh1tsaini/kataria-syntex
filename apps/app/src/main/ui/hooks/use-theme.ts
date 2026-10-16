import { useCallback, useSyncExternalStore } from "react";
import { reportThemeBackground } from "@/lib/platform";

type Theme = "light" | "dark";

export type ThemePreference = "light" | "dark" | "system";

export type ToggleThemeEvent =
  | React.MouseEvent
  | MouseEvent
  | { clientX: number; clientY: number }
  | undefined;

const THEME_KEY = "kataria-theme";

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

function readPreference(): ThemePreference {
  return readStoredTheme() ?? "system";
}

/** Applies the persisted (or system) theme before first paint (see also /theme-init.js). */
export function initTheme() {
  current = readStoredTheme() ?? systemTheme();
  desiredTheme = current;
  apply(current);
}

let current: Theme = readStoredTheme() ?? systemTheme();
let desiredTheme: Theme = current;
let busy = false;
let queued = false;

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
      desiredTheme = current;
      apply(current);
      emit();
    });
  // Another tab changed the preference — re-resolve and re-render here.
  window.addEventListener("storage", (e) => {
    if (e.key !== THEME_KEY) return;
    current = readStoredTheme() ?? systemTheme();
    desiredTheme = current;
    apply(current);
    emit();
  });
}

function pump() {
  if (!queued) return;
  queued = false;
  if (current === desiredTheme) return;

  const next = desiredTheme;
  const root = document.documentElement;

  let applied = false;
  const changeTheme = () => {
    if (applied) return;
    applied = true;
    current = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage unavailable (private mode) — theme still applies for this session.
    }
    apply(next);
    emit();
  };

  const isReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (
    typeof document === "undefined" ||
    !("startViewTransition" in document) ||
    isReducedMotion
  ) {
    changeTheme();
    busy = false;
    pump();
    return;
  }

  busy = true;
  root.classList.add("vt");

  let released = false;
  let readySeen = false;
  let stallTimer = 0;

  const release = (applyNow: boolean) => {
    if (released) return;
    released = true;
    window.clearTimeout(stallTimer);
    if (applyNow && !applied) changeTheme();
    root.classList.remove("vt");
    busy = false;
    pump();
  };

  try {
    const transition = document.startViewTransition(() => {
      changeTheme();
    });

    transition.ready
      .then(() => {
        readySeen = true;
        window.clearTimeout(stallTimer);
      })
      .catch(() => {
        window.clearTimeout(stallTimer);
      });

    // Watchdog: if the compositor stalls (hidden tab or webview capture freeze),
    // ensure theme flips immediately and queue releases.
    stallTimer = window.setTimeout(() => {
      if (!readySeen) release(true);
    }, 250);

    transition.finished
      .catch(() => {})
      .finally(() => {
        release(false);
      });
  } catch {
    release(true);
  }
}

export function useTheme() {
  const theme = useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );
  const preference = useSyncExternalStore(
    subscribe,
    readPreference,
    readPreference,
  );

  const setTheme = useCallback((mode: ThemePreference) => {
    try {
      if (mode === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, mode);
    } catch {
      // Storage unavailable (private mode) — theme still applies for this session.
    }
    current = mode === "system" ? systemTheme() : mode;
    desiredTheme = current;
    apply(current);
    emit();
  }, []);

  const toggleTheme = useCallback((_event?: ToggleThemeEvent) => {
    desiredTheme = desiredTheme === "dark" ? "light" : "dark";
    queued = true;
    if (!busy) pump();
  }, []);

  return { theme, preference, setTheme, toggleTheme };
}
