/**
 * Update-flow tests — the Android staging pipeline with every native module
 * faked. The store, manifest gate, staging marker, and failure vocabulary run
 * for real; expo-file-system, expo-crypto, expo-notifications and
 * expo-intent-launcher are stand-ins. Nothing here touches a device.
 */

// ── Native module fakes (mock-prefixed: jest hoists the factories above) ─────

/** One flat fake disk keyed by file name. */
const mockDisk = new Map<string, Uint8Array>();
const mockState = {
  failNextDownload: false,
  requiredHandler: null as ((minVersion: string) => void) | null,
};

class MockDirectory {
  uri: string;
  constructor(...parts: unknown[]) {
    this.uri = parts.map((p) => String(p)).join("/");
  }
  get exists(): boolean {
    return true;
  }
  create(): void {}
}

class MockFile {
  uri: string;
  constructor(...parts: unknown[]) {
    const first = parts[0];
    const dir =
      first instanceof MockDirectory
        ? first.uri
        : first === undefined
          ? ""
          : String(first);
    this.uri = dir
      ? `${dir}/${String(parts[1] ?? "")}`
      : String(parts[1] ?? "");
  }
  get name(): string {
    return this.uri.split("/").pop() ?? "";
  }
  get exists(): boolean {
    return mockDisk.has(this.name);
  }
  get size(): number {
    return mockDisk.get(this.name)?.length ?? 0;
  }
  get contentUri(): string {
    return `content://test/${this.name}`;
  }
  async bytes(): Promise<Uint8Array> {
    return mockDisk.get(this.name) ?? new Uint8Array();
  }
  delete(): void {
    mockDisk.delete(this.name);
  }
  move(target: MockFile): void {
    const entry = mockDisk.get(this.name);
    if (entry) {
      mockDisk.delete(this.name);
      mockDisk.set(target.name, entry);
    }
  }
}

const mockCreateDownloadTask = jest.fn(
  (
    _url: string,
    file: MockFile,
    options?: { onProgress?: (p: unknown) => void },
  ) => ({
    downloadAsync: async () => {
      options?.onProgress?.({ bytesWritten: 8, totalBytes: 100 });
      if (mockState.failNextDownload) {
        mockState.failNextDownload = false;
        throw new Error("UnableToDownload");
      }
      mockDisk.set(file.name, new Uint8Array(8).fill(7));
      return file;
    },
  }),
);

class MockFlowFile extends MockFile {
  static createDownloadTask = mockCreateDownloadTask;
}

jest.mock("expo-file-system", () => ({
  Paths: { cache: "/cache" },
  Directory: MockDirectory,
  File: MockFlowFile,
}));
jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digest: jest.fn(async () => new Uint8Array(32).buffer),
}));
jest.mock("expo-notifications", () => ({
  AndroidImportance: { DEFAULT: 3 },
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  setNotificationChannelAsync: jest.fn(async () => null),
  dismissAllNotificationsAsync: jest.fn(async () => {}),
  scheduleNotificationAsync: jest.fn(async () => "id"),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove() {} })),
}));
jest.mock("expo-intent-launcher", () => ({
  startActivityAsync: jest.fn(async () => ({ resultCode: -1 })),
}));

const mockKv = new Map<string, string>();

jest.mock("@kataria-syntex/app-core", () => ({
  core: () => ({
    apiBaseUrl: "https://api.test",
    storage: {
      get: (key: string) => mockKv.get(key) ?? null,
      set: (key: string, value: string) => void mockKv.set(key, value),
      delete: (key: string) => void mockKv.delete(key),
    },
  }),
  setUpdateRequiredHandler: (fn: (minVersion: string) => void) => {
    mockState.requiredHandler = fn;
  },
}));

jest.mock("@/platform/adapter", () => ({
  appVersion: () => "0.30.0",
  onAppStateChange: () => () => {},
}));

import * as Notifications from "expo-notifications";
import * as IntentLauncher from "expo-intent-launcher";

// ── Helpers ──────────────────────────────────────────────────────────────────

const MANIFEST = {
  version: "0.31.0",
  android: { apk: "/releases/app/android/Kataria-Syntex-Biz-App-0.31.0.apk" },
};

function mockManifest(body: unknown, ok = true) {
  global.fetch = jest.fn(async () => ({
    ok,
    json: async () => body,
  })) as unknown as typeof fetch;
}

/** Yields until `predicate` is true or attempts run out. */
async function until(predicate: () => boolean, attempts = 50): Promise<void> {
  for (let i = 0; i < attempts && !predicate(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

type FlowModule = typeof import("@/platform/update-flow");

/** Fresh module instances so each test starts from clean module state.
 *  resetModules re-runs the factories, so the current mock handles are
 *  returned alongside the flow module. */
function freshFlow(): {
  flow: FlowModule;
  notifications: typeof Notifications;
  intentLauncher: typeof IntentLauncher;
} {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const flow = require("@/platform/update-flow") as FlowModule;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const notifications = require("expo-notifications") as typeof Notifications;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const intentLauncher =
    require("expo-intent-launcher") as typeof IntentLauncher;
  return { flow, notifications, intentLauncher };
}

beforeEach(() => {
  mockDisk.clear();
  mockKv.clear();
  mockState.failNextDownload = false;
  mockState.requiredHandler = null;
  jest.clearAllMocks();
});

describe("update flow", () => {
  it("stages a newer release, marks it ready, notifies once", async () => {
    mockManifest(MANIFEST);
    const { flow, notifications, intentLauncher } = freshFlow();
    const outcome = await flow.useUpdates.getState().checkNow();
    expect(outcome).toBe("available");
    await until(() => flow.useUpdates.getState().status === "ready");
    expect(flow.useUpdates.getState().latestVersion).toBe("0.31.0");
    expect(mockKv.get("android.stagedApkVersion")).toBe("0.31.0");
    expect(mockDisk.has("ks-biz-app.apk")).toBe(true);
    await until(
      () =>
        (notifications.scheduleNotificationAsync as jest.Mock).mock.calls
          .length > 0,
    );
    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mockKv.get("updates.notifiedVersion")).toBe("0.31.0");
  });

  it("stays idle when the manifest matches the running build", async () => {
    mockManifest({ ...MANIFEST, version: "0.30.0" });
    const { flow, notifications, intentLauncher } = freshFlow();
    const outcome = await flow.useUpdates.getState().checkNow();
    expect(outcome).toBe("up-to-date");
    expect(flow.useUpdates.getState().status).toBe("idle");
    expect(mockDisk.size).toBe(0);
  });

  it("reports manifest_unavailable when the feed cannot be read", async () => {
    mockManifest(null, false);
    const { flow, notifications, intentLauncher } = freshFlow();
    const outcome = await flow.useUpdates.getState().checkNow();
    expect(outcome).toBe("error");
    expect(flow.useUpdates.getState().failure).toBe("manifest_unavailable");
  });

  it("maps a failed download to download_failed and stages nothing", async () => {
    mockManifest(MANIFEST);
    mockState.failNextDownload = true;
    const { flow, notifications, intentLauncher } = freshFlow();
    await flow.useUpdates.getState().checkNow();
    await until(() => flow.useUpdates.getState().status === "error");
    expect(flow.useUpdates.getState().failure).toBe("download_failed");
    expect(mockDisk.has("ks-biz-app.apk")).toBe(false);
  });

  it("arms the gate for a floor above the build and keeps the highest", async () => {
    const { flow, notifications, intentLauncher } = freshFlow();
    expect(mockState.requiredHandler).not.toBeNull();
    mockState.requiredHandler?.("0.32.0");
    expect(flow.useUpdates.getState().requiredMinVersion).toBe("0.32.0");
    // A floor this build already satisfies never arms the gate.
    mockState.requiredHandler?.("0.30.0");
    expect(flow.useUpdates.getState().requiredMinVersion).toBe("0.32.0");
    // A lower live floor never lowers an armed one.
    mockState.requiredHandler?.("0.31.0");
    expect(flow.useUpdates.getState().requiredMinVersion).toBe("0.32.0");
  });

  it("installs the staged build through the system installer", async () => {
    mockManifest(MANIFEST);
    const { flow, notifications, intentLauncher } = freshFlow();
    await flow.useUpdates.getState().checkNow();
    await until(() => flow.useUpdates.getState().status === "ready");
    await flow.useUpdates.getState().installUpdate();
    expect(intentLauncher.startActivityAsync).toHaveBeenCalledTimes(1);
    const [action, params] = (intentLauncher.startActivityAsync as jest.Mock)
      .mock.calls[0];
    expect(action).toBe("android.intent.action.VIEW");
    expect(params.data).toBe("content://test/ks-biz-app.apk");
    expect(params.type).toBe("application/vnd.android.package-archive");
  });
});
