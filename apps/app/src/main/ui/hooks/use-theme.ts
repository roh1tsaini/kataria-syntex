import { useCallback, useSyncExternalStore } from "react";
import { reportThemeBackground } from "@/lib/platform";
import { EASE_OUT } from "@/ui/lib/motion";

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
  apply(current);
}

let current: Theme = readStoredTheme() ?? systemTheme();

/** Overlapping flips share the `html.vt` freeze; the last one out removes it. */
let activeFlips = 0;

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
  // Another tab changed the preference — re-resolve and re-render here.
  window.addEventListener("storage", (e) => {
    if (e.key !== THEME_KEY) return;
    current = readStoredTheme() ?? systemTheme();
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
    apply(current);
    emit();
  }, []);

  const toggleTheme = useCallback((_event?: ToggleThemeEvent) => {
    const next: Theme = current === "dark" ? "light" : "dark";

    const changeTheme = () => {
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
      return;
    }

    // Wallpaper settle (design.md Section 5.2): the old layer fades out while
    // settling 1→0.98, the new layer fades in from 1.02→1. Inner transitions
    // freeze for the snapshot so the settle carries the whole motion.
    const root = document.documentElement;
    const easing = `cubic-bezier(${EASE_OUT.join(", ")})`;
    activeFlips += 1;
    root.classList.add("vt");

    const transition = document.startViewTransition(() => {
      changeTheme();
    });

    transition.finished
      .catch(() => {})
      .finally(() => {
        activeFlips -= 1;
        if (activeFlips === 0) root.classList.remove("vt");
      });

    transition.ready
      .then(() => {
        root.animate(
          { opacity: [1, 0], transform: ["scale(1)", "scale(0.98)"] },
          {
            duration: 420,
            easing,
            fill: "both",
            pseudoElement: "::view-transition-old(root)",
          } as KeyframeAnimationOptions,
        );
        root.animate(
          { opacity: [0, 1], transform: ["scale(1.02)", "scale(1)"] },
          {
            duration: 450,
            easing,
            fill: "both",
            pseudoElement: "::view-transition-new(root)",
          } as KeyframeAnimationOptions,
        );
      })
      .catch(() => {
        // The flip was skipped — the theme change already landed.
      });
  }, []);

  return { theme, preference, setTheme, toggleTheme };
}
