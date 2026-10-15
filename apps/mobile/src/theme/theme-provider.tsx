/**
 * Theme root: resolves the semantic tokens into the running theme and hands
 * them to NativeWind.
 *
 * `vars()` binds every `--token` (src/theme/tokens.ts) to the subtree, so a
 * class like `bg-background` paints the light or dark value without a single
 * `dark:` variant — the same way the web app resolves its CSS variables.
 * `colorScheme.set()` keeps NativeWind's own variant machinery (and the
 * keyboard appearance) in step for the handful of places that need it.
 */
import type { ReactNode } from "react";
import { useEffect } from "react";
import { View } from "react-native";
import { vars, colorScheme } from "nativewind";
import * as SystemUI from "expo-system-ui";
import { StatusBar } from "expo-status-bar";

import { darkTheme, lightTheme } from "@/theme/tokens";
import { derivedTokens } from "@/theme/derived";
import { useTheme } from "@/theme/theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const tokens = theme === "dark" ? darkTheme : lightTheme;
  const variables = { ...tokens, ...derivedTokens(theme) };

  useEffect(() => {
    colorScheme.set(theme);
    // The window behind React's root view must match, or a rotation or a
    // sheet overshoot flashes the wrong color at the edges.
    void SystemUI.setBackgroundColorAsync(tokens["--background"]);
  }, [theme, tokens]);

  return (
    <View style={vars(variables)} className="flex-1 bg-background">
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      {children}
    </View>
  );
}
