/**
 * Root layout — the Android boot sequence, equivalent to apps/app's
 * main.tsx boot + App mount effect:
 * 1. configureAndroidCore() + toast sink (module scope — runs before any
 *    screen renders, so no store/API call can be unconfigured)
 * 2. auth bootstrap() + masters cache hydration + offline sync wiring
 * 3. update checks (manifest poll → banner / blocking dialog)
 * All screens render as Stack routes; app/index.tsx is the auth gate.
 */

import "../global.css";
import { Component, useEffect, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useAuth,
  useOfflineSync,
  useRealtime,
  hydrateMastersCache,
} from "@kataria-syntex/app-core";
import { usePalette } from "@/theme";
import { configureAndroidCore } from "@/lib/core-adapter";
import { configureAndroidToasts } from "@/lib/toasts";
import { initUpdateChecks } from "@/lib/updates";
import { UpdateBanner, UpdateBlockingDialog } from "@/ui/update-surface";

// Boot before first render — idempotent under StrictMode double-mount.
configureAndroidCore();
configureAndroidToasts();

try {
  void SplashScreen.preventAutoHideAsync();
} catch {
  // Already prevented — StrictMode double-mount.
}

/**
 * Boot failure surface. The boot sequence runs before any route exists, so a
 * throw here used to leave a blank window (and an automatic reset retried the
 * same failing render forever). Retry is user-triggered instead.
 */
function BootErrorScreen({ onRetry }: { onRetry: () => void }) {
  const p = usePalette();
  return (
    <View
      className="flex-1 items-center justify-center gap-3 px-8"
      style={{ backgroundColor: p.background }}
    >
      <Text
        className="text-[17px] font-semibold"
        style={{ color: p.foreground }}
      >
        Something went wrong
      </Text>
      <Text
        className="text-center text-[13px]"
        style={{ color: p.mutedForeground }}
      >
        The app could not finish starting. Try again.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        className="min-h-[44px] items-center justify-center rounded-md px-5"
        style={({ pressed }) => ({
          backgroundColor: p.primary,
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <Text
          className="text-[15px] font-semibold"
          style={{ color: p.primaryForeground }}
        >
          Try again
        </Text>
      </Pressable>
    </View>
  );
}

class BootBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.error("boot_error", error);
    void SplashScreen.hideAsync().catch(() => undefined);
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <BootErrorScreen onRetry={() => this.setState({ failed: false })} />
      );
    }
    return this.props.children;
  }
}

function Boot() {
  const status = useAuth((s) => s.status);
  const bootstrap = useAuth((s) => s.bootstrap);
  const refreshCompany = useAuth((s) => s.refreshCompany);
  useOfflineSync();
  useRealtime();

  useEffect(() => {
    void bootstrap().finally(() => {
      void SplashScreen.hideAsync().catch(() => undefined);
    });
    initUpdateChecks();
  }, [bootstrap]);

  // /auth/me establishes identity; /company establishes the company profile,
  // current FY and numbering counters used by every register/editor.
  useEffect(() => {
    if (status === "authed") {
      void refreshCompany().catch(() => undefined);
      // Masters hydrate once a session exists — the store's own cache, so a
      // returning user paints registers before the network answers.
      void hydrateMastersCache();
    }
    if (status !== "loading") {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [status, refreshCompany]);

  return null;
}

function ThemedStatusBar() {
  const p = usePalette();
  return <StatusBar style={p.scheme === "dark" ? "light" : "dark"} />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemedStatusBar />
        <BootBoundary>
          <Boot />
          <View className="flex-1">
            <UpdateBanner />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="auth" />
              <Stack.Screen name="login/scan/[code]" />
              <Stack.Screen name="challan-detail" />
              <Stack.Screen name="challan-editor" />
              <Stack.Screen name="members" />
              <Stack.Screen name="devices" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="stock" />
              <Stack.Screen name="masters" />
              <Stack.Screen name="colors" />
              <Stack.Screen name="returns" />
              <Stack.Screen name="raw-material" />
              <Stack.Screen name="reports" />
            </Stack>
          </View>
          <UpdateBlockingDialog />
        </BootBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
