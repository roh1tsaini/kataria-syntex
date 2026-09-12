/**
 * Theme persistence + system-scheme sync — the Android counterpart of web's
 * ui/hooks/use-theme. The palette store itself lives in @/theme; this module
 * owns where the choice comes from and where it is remembered.
 *
 * A stored choice wins; with none, the OS scheme is followed live (and keeps
 * following it until the user picks one). Preferences ride the adapter's
 * uiStorage, which is deliberately never wiped on logout — same contract as
 * the web app's localStorage preferences.
 */

import { Appearance } from "react-native";
import { uiStorage } from "@/lib/core-adapter";
import { themeStore, type Scheme } from "@/theme";

const SCHEME_KEY = "kataria.theme.scheme";

function storedScheme(): Scheme | null {
  const raw = uiStorage.get(SCHEME_KEY);
  return raw === "light" || raw === "dark" ? raw : null;
}

function systemScheme(): Scheme {
  return Appearance.getColorScheme() === "dark" ? "dark" : "light";
}

let initialized = false;

/** Applies the stored (or system) theme before first paint, then follows
 *  later system changes while the user hasn't pinned a scheme. Idempotent —
 *  StrictMode's double mount must not register the Appearance listener twice. */
export function initTheme(): void {
  if (initialized) return;
  initialized = true;

  themeStore.setScheme(storedScheme() ?? systemScheme());

  Appearance.addChangeListener(({ colorScheme }) => {
    if (storedScheme()) return;
    themeStore.setScheme(colorScheme === "dark" ? "dark" : "light");
  });
}

export function setScheme(scheme: Scheme): void {
  uiStorage.set(SCHEME_KEY, scheme);
  themeStore.setScheme(scheme);
}
