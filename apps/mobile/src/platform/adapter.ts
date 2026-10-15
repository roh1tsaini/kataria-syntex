/**
 * Android shell adapter — apps/mobile's implementation of app-core's
 * PlatformAdapter seam (packages/app-core/src/adapter.ts).
 *
 * This app is the Android shell: expo-secure-store keeps the bearer token in
 * the Android Keystore, NetInfo answers reachability, and the offline KV lives
 * in AsyncStorage behind a synchronous session map (the offline engine reads
 * synchronously; AsyncStorage does not). app-core itself is unchanged — the
 * business logic is shared with the web app, only this seam is native.
 *
 * `host: "android"` even in the browser: the expo web target exists only as the
 * verification renderer for this same bundle (Playwright), never as a product
 * surface, so it must behave exactly like the phone.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { Platform } from "react-native";

import {
  configureCore,
  type CoreStorage,
  type PlatformAdapter,
} from "@kataria-syntex/app-core";

/** Release origin, used when the build carries no EXPO_PUBLIC_API_URL — the
 *  same fallback the config applies to the deep-link host. */
const DEFAULT_API_ORIGIN = "https://app.katariasyntex.workers.dev";

/** Keystore slot for the session token. Never mirrored to AsyncStorage: a
 *  secure store that quietly degrades to a readable file is not a secure
 *  store, so an unreachable keystore means the user signs in again. */
const TOKEN_KEY = "auth.token.v1";

/** Absolute API origin. A bare FQDN (the APP_URL repo variable's shape) is
 *  upgraded to https; an empty value falls back to the release origin so a dev
 *  build still reaches a real server. */
function apiOrigin(): string {
  const raw = (
    process.env.EXPO_PUBLIC_API_URL ??
    process.env.APP_URL ??
    ""
  ).trim();
  if (!raw) return DEFAULT_API_ORIGIN;
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, "");
  return `https://${raw.replace(/\/+$/, "")}`;
}

/** The version this build announces to the server (X-App-Version, which drives
 *  the 426 update gate). app.config.ts bakes it from apps/app/package.json. */
export function appVersion(): string {
  const version =
    Constants.expoConfig?.version ??
    (Constants as any).manifest?.version ??
    "0.0.1";
  return version;
}

export function apiBaseUrl(): string {
  return apiOrigin();
}

// ── Offline KV: session-authoritative map over AsyncStorage ──────────────────

const sessionKv = new Map<string, string>();

function asyncStorageKv(): CoreStorage {
  return {
    get(key) {
      return sessionKv.get(key) ?? null;
    },
    set(key, value) {
      sessionKv.set(key, value);
      AsyncStorage.setItem(key, value).catch(() => {
        // Store unavailable — the session map still serves this run.
      });
    },
    delete(key) {
      sessionKv.delete(key);
      AsyncStorage.removeItem(key).catch(() => {
        // Store unavailable — the session map is authoritative either way.
      });
    },
  };
}

/** Loads persisted offline caches into the session map. Awaited once before
 *  the first render: the offline engine reads synchronously, so an unhydrated
 *  map would look like a fresh install until the next launch. A write that
 *  already happened this boot wins — hydration only fills untouched keys. */
async function hydrateKv(): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter(
      (key) => !sessionKv.has(key),
    );
    if (keys.length === 0) return;
    const entries = await AsyncStorage.multiGet(keys);
    entries.forEach(([key, val]) => {
      if (val !== null && !sessionKv.has(key)) sessionKv.set(key, val);
    });
  } catch {
    // Fresh install or unavailable storage — the empty map starts cold.
  }
}

// ── Keystore: expo-secure-store behind the bearer seam ───────────────────────

async function readToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return typeof localStorage !== "undefined"
        ? localStorage.getItem(TOKEN_KEY)
        : null;
    }
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function writeToken(token: string | null): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
      }
      return;
    }
    if (token) {
      await SecureStore.setItemAsync(TOKEN_KEY, token, {
        keychainAccessible: SecureStore.ALWAYS,
      });
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch {
    // Keystore unavailable
  }
}

// ── NetInfo: native connectivity listener ────────────────────────────────────

function onNetworkChange(callback: (online: boolean) => void): () => void {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const onlineHandler = () => callback(true);
    const offlineHandler = () => callback(false);
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    callback(navigator.onLine);
    return () => {
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
    };
  }

  return NetInfo.addEventListener((state) => {
    callback(Boolean(state.isConnected && state.isInternetReachable !== false));
  });
}

// ── Boot: hydrate once, configure the seam, expose the ready promise ─────────

let readyPromise: Promise<void> | null = null;

export function initMobileAdapter(): Promise<void> {
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    await hydrateKv();
    const adapter: PlatformAdapter = {
      host: "android",
      apiBaseUrl: apiOrigin(),
      appVersion: appVersion(),
      storage: asyncStorageKv(),
      readToken,
      writeToken,
      onNetworkChange,
    };
    configureCore(adapter);
  })();
  return readyPromise;
}

export const initAdapter = initMobileAdapter;
