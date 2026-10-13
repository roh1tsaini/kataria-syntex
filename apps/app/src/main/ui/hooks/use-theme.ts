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

    // Stripe Center Iris: concentric circle expanding from viewport center
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const endRadius = Math.hypot(cx, cy);

    const transition = document.startViewTransition(() => {
      changeTheme();
    });

    transition.ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${cx}px ${cy}px)`,
              `circle(${endRadius}px at ${cx}px ${cy}px)`,
            ],
          },
          {
            duration: 450,
            easing: "cubic-bezier(0.2, 0, 0, 1)",
            pseudoElement: "::view-transition-new(root)",
          } as KeyframeAnimationOptions,
        );
      })
      .catch(() => {
        // Fallback in case animation rejects
      });
  }, []);

  return { theme, preference, setTheme, toggleTheme };
}
