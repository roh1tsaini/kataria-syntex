/**
 * The Android PlatformAdapter — app-core's shell seam for React Native.
 * One configureAndroidCore() call at boot wires everything the shared
 * business logic needs:
 *
 * - storage: MMKV (synchronous, ~10x faster than AsyncStorage — the offline
 *   engine's KV contract is synchronous by design)
 * - token: expo-secure-store (hardware-backed keystore encryption; owner
 *   mandate: encrypted storage or nothing, never plaintext)
 * - network: @react-native-community/netinfo connectivity events
 * - apiBaseUrl: from Expo Constants (extra.apiBaseUrl baked by app.config.ts;
 *   dev default http://localhost:3000 works over `adb reverse tcp:3000`)
 */

import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import NetInfo from "@react-native-community/netinfo";
import { createMMKV } from "react-native-mmkv";
import { configureCore, type CoreStorage } from "@kataria-syntex/app-core";
const TOKEN_KEY = "auth.sessionToken";

const mmkv = createMMKV({ id: "ks-app-core" });

/** MMKV IS synchronous — matches CoreStorage exactly, no shims needed. */
function mmkvStorage(): CoreStorage {
  return {
    get: (key) => mmkv.getString(key) ?? null,
    set: (key, value) => {
      mmkv.set(key, value);
    },
    delete: (key) => {
      mmkv.remove(key);
    },
  };
}

export function deviceLabel(): string {
  return "Android";
}

export function apiBaseUrl(): string {
  const baked = Constants.expoConfig?.extra?.apiBaseUrl;
  if (typeof baked === "string" && baked) return baked;
  // Dev: `adb reverse tcp:3000 tcp:3000` maps device localhost to the
  // machine running `bun run dev:server`.
  return "http://localhost:3000";
}

export function appVersion(): string {
  return Constants.expoConfig?.version ?? "0.0.0";
}

/** Configures app-core for Android. Call once at the top of the root
 * layout, before any store/API access (StrictMode-safe: idempotent). */
export function configureAndroidCore(): void {
  configureCore({
    host: "android",
    apiBaseUrl: apiBaseUrl(),
    appVersion: appVersion(),
    storage: mmkvStorage(),
    async readToken() {
      try {
        return await SecureStore.getItemAsync(TOKEN_KEY);
      } catch {
        // Keystore unavailable — re-auth this launch, never fall back to
        // plaintext storage (owner mandate).
        return null;
      }
    },
    async writeToken(token) {
      try {
        if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
        else await SecureStore.deleteItemAsync(TOKEN_KEY);
      } catch {
        // Non-fatal: this run keeps the in-memory bearer; the next launch
        // simply asks again.
      }
    },
    deviceLabel,
    onNetworkChange(onChange) {
      const unsub = NetInfo.addEventListener((s) =>
        onChange(s.isConnected === true),
      );
      return unsub;
    },
  });
}
