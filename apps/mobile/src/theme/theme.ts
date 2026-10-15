/**
 * Theme — the RN mirror of apps/app's `ui/hooks/use-theme.ts`.
 *
 * Same contract as the web app: a persisted preference under `kataria-theme`
 * ("light" | "dark"), absent meaning "follow the system"; the resolved theme
 * flips the app's own dark variant and every semantic color token. The store is
 * module-level so non-React boot code (the adapter, the splash) can read it.
 *
 * Persistence uses AsyncStorage rather than the offline KV on purpose: the
 * theme is device UI state, not account data, and must survive a logout.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance } from "react-native";
import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";

const THEME_KEY = "kataria-theme";

let preference: ThemePreference = "system";
let current: Theme = resolveTheme("system");

const listeners = new Set<() => void>();

function resolveTheme(next: ThemePreference): Theme {
  if (next !== "system") return next;
  return Appearance.getColorScheme() === "dark" ? "dark" : "light";
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Applies a preference in memory — storage is the caller's business. */
function applyPreference(next: ThemePreference): void {
  preference = next;
  current = resolveTheme(next);
  emit();
}

/** Reads the persisted preference; called once at boot before first paint. */
export async function initTheme(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(THEME_KEY);
    applyPreference(raw === "light" || raw === "dark" ? raw : "system");
  } catch {
    applyPreference("system");
  }
}

/* Following the system only when the user has not chosen for themselves. */
Appearance.addChangeListener(() => {
  if (preference === "system") applyPreference("system");
});

export function resolvedTheme(): Theme {
  return current;
}

export function useTheme(): {
  theme: Theme;
  preference: ThemePreference;
  setTheme: (next: ThemePreference) => void;
  toggleTheme: () => void;
} {
  const theme = useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );
  const preferenceValue = useSyncExternalStore(
    subscribe,
    () => preference,
    () => preference,
  );

  return {
    theme,
    preference: preferenceValue,
    setTheme(next) {
      applyPreference(next);
      const write =
        next === "system"
          ? AsyncStorage.removeItem(THEME_KEY)
          : AsyncStorage.setItem(THEME_KEY, next);
      write.catch(() => {
        // Storage unavailable — the choice still applies for this session.
      });
    },
    toggleTheme() {
      const next: Theme = current === "dark" ? "light" : "dark";
      applyPreference(next);
      AsyncStorage.setItem(THEME_KEY, next).catch(() => {
        // Storage unavailable — the choice still applies for this session.
      });
    },
  };
}
