/**
 * Jest environment for every test in this app.
 *
 * NativeWind resolves `className` through the CSS-interop runtime; tests only
 * assert behaviour and copy, never resolved colors, so the runtime's
 * animation/`useColorScheme` hooks stay mocked where they would touch native
 * modules that jest-expo cannot load.
 */
import { jest } from "@jest/globals";

// Lucide publishes its React Native condition as ESM `.mjs`; Jest's Expo
// transformer only handles JS/TS extensions. Icons are decorative in these
// behavior tests, so keep the production bundle untouched and render no SVG.
jest.mock(
  "lucide-react-native",
  () =>
    new Proxy(
      {},
      {
        get: (_target, key) => (key === "__esModule" ? true : () => null),
      },
    ),
);

// expo-secure-store / async-storage / netinfo all ship jest mocks; the ones
// that matter to stores and screens are registered centrally here.
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        store.delete(key);
      }),
      getAllKeys: jest.fn(async () => [...store.keys()]),
      multiGet: jest.fn(async (keys: readonly string[]) =>
        keys.map((key) => [key, store.get(key) ?? null] as const),
      ),
      multiSet: jest.fn(
        async (pairs: ReadonlyArray<readonly [string, string]>) => {
          for (const [key, value] of pairs) store.set(key, value);
        },
      ),
      multiRemove: jest.fn(async (keys: readonly string[]) => {
        for (const key of keys) store.delete(key);
      }),
    },
  };
});

// NetInfo reports online with a subscription that never fires in tests.
jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => () => {}),
    fetch: jest.fn(async () => ({
      isConnected: true,
      isInternetReachable: true,
    })),
  },
}));
