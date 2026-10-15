# apps/mobile — product reference

Android phone app for Kataria Syntex business operations. Facts here are
verified against code — update this doc in the same change as the code. Current
state only.

**Owns:** Android native shell, mobile screens, Expo Router navigation,
native keystore storage, camera QR scanning, Playwright mobile viewport tests.
**Does not own:** core business logic/API (`packages/app-core`) · design tokens
(`apps/app/design.md`) · CI/CD and deployment (`DEPLOY.md`).

---

## 1 · What it is

The dedicated mobile client for Kataria Syntex on Android phones. Built for
floor operations: raw material inward, job worker send/receive, coning,
packing, and stock lookup.

- Runs natively on Android phones (ARM only: `armeabi-v7a`, `arm64-v8a`).
- Shares business logic, stores, validation, and API contracts with the web and
  desktop apps via `@kataria-syntex/app-core` and `@kataria-syntex/shared`.
- Secure session tokens stored directly in Android Keystore via
  `expo-secure-store`.
- Offline cache backed by `@react-native-async-storage/async-storage` behind a
  synchronous session map.
- Camera access for scanning QR login codes and fast device authorization.

## 2 · Tech stack

| Layer        | Tech                                                                  |
| ------------ | --------------------------------------------------------------------- |
| Framework    | Expo SDK 57 (React Native 0.86, React 19)                             |
| Routing      | Expo Router (file-based routing with typed routes)                    |
| Styling      | NativeWind v4 (Tailwind CSS matching `design.md` mobile scale)        |
| Shared logic | `@kataria-syntex/app-core` (Zustand stores, API client, adapter seam) |
| Shared types | `@kataria-syntex/shared` (validations, formatting, error codes)       |
| Storage      | `expo-secure-store` (Keystore AES-GCM) + `async-storage` (offline)    |
| Connectivity | `@react-native-community/netinfo`                                     |
| Camera / QR  | `expo-camera` + `react-native-qrcode-svg`                             |
| Build engine | Expo prebuild (`plugins/with-android-release.ts`) + Gradle release    |
| Testing      | Jest (`jest-expo`) + Playwright mobile viewport E2E                   |

## 3 · Source map

```
apps/mobile/
├── app.config.ts               # dynamic Expo config (reads apps/app/package.json version)
├── babel.config.js             # babel preset expo + NativeWind JSX transform
├── tailwind.config.js          # phone design tokens from apps/app/design.md
├── plugins/
│   └── with-android-release.ts # config plugin: release keystore + versioned APK name
├── scripts/
│   ├── generate-assets.ts      # app icons and splash generation via sharp
│   ├── generate-tokens.ts      # syncs Tailwind tokens from design system
│   └── serve-dist.ts           # static web preview server for Playwright E2E
├── e2e/
│   ├── auth.spec.ts            # mobile auth and QR login viewport tests
│   ├── devices.spec.ts         # devices management and settings tests
│   └── responsive.spec.ts      # Pixel 7 viewport responsive check
└── src/
    ├── app/                    # Expo Router routes
    │   ├── _layout.tsx         # root layout: font loading, splash, theme, adapter init
    │   ├── +not-found.tsx      # fallback route
    │   ├── auth.tsx            # sign-in screen (OTP, password, QR login)
    │   ├── downloads.tsx       # downloads & release notes screen
    │   ├── login/scan/[code].tsx # deep-link target for QR approval
    │   └── (shell)/            # authenticated app shell
    │       ├── _layout.tsx     # tab bar & shell drawer layout
    │       ├── index.tsx       # dashboard / overview
    │       ├── devices.tsx     # connected devices management
    │       └── settings.tsx    # user profile & preferences
    ├── components/
    │   ├── app-shell.tsx       # mobile header + drawer + offline indicator
    │   ├── nav-drawer.tsx      # swipeable mobile navigation drawer
    │   ├── qr-login-panel.tsx  # QR pairing code generator & polling
    │   ├── require-auth.tsx    # route authentication guard
    │   ├── offline-banner.tsx  # floating connectivity banner
    │   └── ui/                 # primitive controls (button, card, input, sheet, etc.)
    └── platform/
        ├── adapter.ts          # app-core PlatformAdapter implementation
        └── update-flow.ts      # native update listener seam
```

## 4 · Platform adapter seam

`src/platform/adapter.ts` binds `@kataria-syntex/app-core` to Android native APIs:

- **Host identification:** `host: "android"` across all environments (including
  web export during Playwright tests) so behavior matches production.
- **Secure storage:** Bearer session tokens are saved directly to Android
  Keystore via `expo-secure-store` with `keychainAccessible: ALWAYS`.
- **Reachability:** Live connectivity events handled by NetInfo (`isConnected`
  and `isInternetReachable`).
- **Offline KV:** Pre-hydrated synchronously into an in-memory session map from
  `AsyncStorage` before first paint.

## 5 · Deep links and QR scan

- Custom scheme: `kataria://`
- Universal HTTPS filter: `https://<APP_HOST>/login/scan/<code>`
- The deep-link screen approves the incoming browser/desktop session using
  authenticated native credentials.
- The devices screen approve sheet scans the login QR with `expo-camera`
  (`CameraView`, back camera, QR only) or takes a typed code; the first valid
  scan submits and stops the camera.
- Scanned payloads are parsed by `parseQrScanCode` from
  `@kataria-syntex/shared` — a bare code or the `<origin>/login/scan/<code>`
  URL, upper-cased.
- Denied camera permission or a camera failure keeps manual code entry
  available.

## 6 · Build and release

1. **Prebuild:** `bun run prebuild --platform android --clean` generates the
   native Gradle project.
2. **Version derivation:** `app.config.ts` reads `apps/app/package.json` for
   semantic `version` and computes:
   `versionCode = major * 1000000 + minor * 1000 + patch`.
3. **Release signing:** `plugins/with-android-release.ts` injects release
   keystore configuration from `keystore.properties` into `app/build.gradle`.
4. **Binary output:** `assembleRelease` produces
   `Kataria-Syntex-Biz-App-<version>.apk` under
   `android/app/build/outputs/apk/release/`.

## 7 · Verification commands

- **Typecheck:** `bun run --filter=@kataria-syntex/mobile typecheck`
- **Lint:** `bun run --filter=@kataria-syntex/mobile lint`
- **Unit tests:** `bun run --filter=@kataria-syntex/mobile test`
- **E2E tests:** `bun run --filter=@kataria-syntex/mobile test:e2e`
