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
import { ACCENT_NAMES, themeStore, type Scheme } from "@/theme";
import type { AccentName } from "@/theme/tokens";

const SCHEME_KEY = "kataria.theme.scheme";
const ACCENT_KEY = "kataria.theme.accent";

function storedScheme(): Scheme | null {
  const raw = uiStorage.get(SCHEME_KEY);
  return raw === "light" || raw === "dark" ? raw : null;
}

function systemScheme(): Scheme {
  return Appearance.getColorScheme() === "dark" ? "dark" : "light";
}

function isAccentName(value: string): value is AccentName {
  return (ACCENT_NAMES as string[]).includes(value);
}

/** Applies the stored (or system) theme before first paint, then follows
 *  later system changes while the user hasn't pinned a scheme. */
export function initTheme(): void {
  themeStore.setScheme(storedScheme() ?? systemScheme());

  const accent = uiStorage.get(ACCENT_KEY);
  if (accent && isAccentName(accent)) themeStore.setAccent(accent);

  Appearance.addChangeListener(({ colorScheme }) => {
    if (storedScheme()) return;
    themeStore.setScheme(colorScheme === "dark" ? "dark" : "light");
  });
}

export function setScheme(scheme: Scheme): void {
  uiStorage.set(SCHEME_KEY, scheme);
  themeStore.setScheme(scheme);
}

export function setAccent(accent: AccentName): void {
  uiStorage.set(ACCENT_KEY, accent);
  themeStore.setAccent(accent);
}
