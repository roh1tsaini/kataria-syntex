/**
 * Root layout — the Android boot sequence, equivalent to apps/app's
 * main.tsx boot + App mount effect:
 * 1. configureAndroidCore() + toast sink (module scope — runs before any
 *    screen renders, so no store/API call can be unconfigured)
 * 2. auth bootstrap() + masters cache hydration + offline sync wiring
 * 3. update checks (manifest poll → banner / blocking dialog)
 * All screens render as Stack routes; app/index.tsx is the auth gate.
 */

import { useEffect } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useAuth,
  useOfflineSync,
  useRealtime,
  hydrateMastersCache,
} from "@kataria-syntex/app-core";
import { configureAndroidCore } from "@/lib/core-adapter";
import { configureAndroidToasts } from "@/lib/toasts";
import { initUpdateChecks } from "@/lib/updates";
import { UpdateSurface } from "@/ui/update-surface";

// Boot before first render — idempotent under StrictMode double-mount.
configureAndroidCore();
configureAndroidToasts();

function Boot() {
  const status = useAuth((s) => s.status);
  useOfflineSync();
  useRealtime();

  useEffect(() => {
    initUpdateChecks();
  }, []);

  useEffect(() => {
    if (status === "authed") hydrateMastersCache();
  }, [status]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Boot />
        <View className="flex-1">
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="auth" />
            <Stack.Screen name="login/scan/[code]" />
            <Stack.Screen name="challan-detail" />
            <Stack.Screen name="challan-editor" />
            <Stack.Screen name="members" />
            <Stack.Screen name="devices" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="stock" />
          </Stack>
        </View>
        <UpdateSurface />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
