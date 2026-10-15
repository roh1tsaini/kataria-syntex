/**
 * Root layout — the app's boot and its three providers.
 *
 * Order matters: theme (so the first paint is in the user's theme), then the
 * app-core adapter (token, storage, network seam — nothing may call the core
 * before it), then the session bootstrap, then update checks. The splash stays
 * up until fonts and boot are both done, exactly once (expo-router renders this
 * layout for every route).
 */
import "../../global.css";

import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
// Per-weight entry points on purpose: the package root registers all 18 Inter
// files, which would embed ~5 MB of unused weights in every shell's bundle.
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { useAuth } from "@kataria-syntex/app-core";

import { initAdapter } from "@/platform/adapter";
import { initUpdateChecks } from "@/platform/update-flow";
import { initTheme } from "@/theme/theme";
import { ThemeProvider } from "@/theme/theme-provider";
import { UpdateGate } from "@/components/update-gate";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [booted, setBooted] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await initTheme();
      await initAdapter();
      if (cancelled) return;
      // Bootstrap is fully self-contained: it catches network errors and 401s
      // and falls back to a cached session or guest status.
      void useAuth.getState().bootstrap();
      // Android update checks: background manifest fetch, silent staging,
      // one system notification per release.
      initUpdateChecks();
      setBooted(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ready = booted && (fontsLoaded || fontError !== null);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              // Routes animate themselves (Page's 160ms fade + rise), so the
              // native slide/zoom stays out of the way — one motion grammar.
              animation: "none",
              contentStyle: { backgroundColor: "transparent" },
            }}
          />
          {/* The 426 gate covers every route; nothing below it is usable
              while the live server demands an update (design.md 3.3). */}
          <UpdateGate />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
