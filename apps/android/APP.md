# APP.md — apps/android reference (maintained)

Single maintained doc for the Android app. Kept current with the code —
**code is truth**; update this doc in the same change that updates code.

**Maintaining rules**

- Change code → change this doc in the same commit. No stale lines.
- Current state only: describe what IS. No past talk, no change history.
- Numbers here are verified against code. When they disagree, fix the doc
  or the code — never let both drift.

---

## 1 · What this is

The Android app for Kataria Syntex — the same business flows as `apps/app`
(sales challans, job-work challans + returns, raw material, packing, stock,
reports, colors) as a native React Native shell. Feature parity with the
web app, per-screen ports of the same flows and copy.

Not a webview. The web app (web/PWA + Electron) and this app are two
bundles sharing one business core (`packages/app-core`): API client,
zustand stores, offline engine, error copy, toast sink, page-cache
registry.

Domain rules, database, API, auth, permissions — all documented in
`apps/app/APP.md` (§6–§10) and shared unchanged.

## 2 · Monorepo & commands

Bun workspaces + Turborepo. Bun is the only package manager.

| Path                | Role                                           |
| ------------------- | ---------------------------------------------- |
| `apps/android`      | Android app (this doc)                         |
| `apps/app`          | Business app — web/PWA + Electron (its APP.md) |
| `packages/app-core` | Shared business core (see `adapter.ts` seam)   |
| `packages/shared`   | Domain types, permissions, errors, numbering   |

```bash
# inside apps/android
bun run start        # Metro dev server (--dev-client)
bun run android      # dev build on a device/emulator
bun run prebuild     # regenerate android/ (expo prebuild --clean)
bun run build:apk    # prebuild + gradle assembleRelease
bun run typecheck    # gate
bun run lint         # gate
```

Root gates unchanged: `bun run typecheck && bun run lint &&
bun run format:check && bun run build` from the repo root. The Android
bundle check is `bunx expo export -p android` (Metro bundles the whole app
without needing an Android SDK).

**Done** = repo-root gates green, web/Electron renderer compiles as one
bundle, `apps/android` typechecks and Metro-bundles. The APK itself is
built by CI (no local Android SDK in this repo's flow).

## 3 · Tech stack

Latest stable majors; never downgrade to escape a break.

| Layer     | Tech                                                                        |
| --------- | --------------------------------------------------------------------------- |
| Runtime   | React Native 0.86 · React 19 · Expo SDK 57                                  |
| Routing   | expo-router (file-based, Stack + bottom Tabs)                               |
| Styling   | NativeWind 4.2 (Tailwind 3.4 classes → RN styles) + theme tokens (§8)       |
| State     | zustand 5 — the shared `packages/app-core` stores                           |
| Storage   | MMKV (`react-native-mmkv`) — synchronous KV for the offline engine          |
| Secrets   | expo-secure-store — bearer token in the hardware-backed keystore            |
| Network   | `@react-native-community/netinfo` — connectivity events for the sync engine |
| Camera    | expo-camera — QR login + device approval scanning                           |
| Files/PDF | expo-file-system (APK + PDF downloads) · expo-sharing · expo-print          |
| Updates   | manifest poll + APK self-install (§7)                                       |
| CI        | GitHub Actions (`pipeline.yml` — android job)                               |

## 4 · Source map

```
apps/android/
├── app/                       # expo-router routes (file = screen)
│   ├── _layout.tsx            # boot: theme, configureAndroidCore, toasts, bootstrap, sync, splash, updates
│   ├── index.tsx              # auth gate
│   ├── auth.tsx               # login (identifier → OTP/password), QR panel
│   ├── login/scan/[code].tsx  # QR approve screen (camera)
│   ├── (tabs)/                # bottom tabs: Dashboard · Challans · Job work · Packing · More
│   │                          #   (each hidden unless the role holds its permission)
│   ├── challan-editor.tsx     # full-screen challan editor
│   ├── challan-detail.tsx
│   ├── returns.tsx · raw-material.tsx · packing.tsx · stock.tsx
│   ├── reports.tsx · colors.tsx · masters.tsx
│   ├── members.tsx · devices.tsx · settings.tsx
├── src/
│   ├── lib/
│   │   ├── core-adapter.ts    # configureAndroidCore() — the app-core seam
│   │   ├── theme.ts           # theme persistence + live system-scheme sync
│   │   ├── updates.ts         # update store: poll manifest, banner, install
│   │   ├── installer.ts       # APK download (expo-file-system) + system installer
│   │   ├── pdf.ts             # server PDF download → share / PrintManager
│   │   ├── toasts.ts          # Android toast sink (configureAndroidToasts)
│   │   ├── use-masters-load.ts # load → block save → nonce-retry (editor forms)
│   │   ├── challan-kinds.ts   # one kind table: registers, detail, editor
│   │   ├── format.ts          # single home for number/date/count formatting
│   │   ├── dashboard-math.ts · motion.ts · cn.ts
│   ├── ui/                    # kit.tsx primitives, count-up.tsx (rolling digits),
│   │                          # sync.tsx, update-surface.tsx, qr-login-panel.tsx,
│   │                          # feather.tsx icons, confirm.ts
│   └── theme/
│       ├── tokens.ts          # GENERATED from globals.css — never hand-edit
│       └── index.ts           # usePalette() (scheme + 6 accents), withAlpha(), SCRIM
├── plugins/with-signing.ts    # wires keystore.properties into the release build
├── scripts/
│   ├── convert-tokens.ts      # globals.css oklch → sRGB → src/theme/tokens.ts
│   └── generate-assets.ts     # resources/icon.svg → assets/*.png (sharp)
├── assets/                    # icon, adaptive-icon, splash-icon, Inter TTFs
├── app.config.ts              # expo config as code (version, versionCode, perms)
├── global.css                 # NativeWind entry (@tailwind directives)
├── tailwind.config.js         # NativeWind config (radius ladder, Inter fonts)
├── metro.config.cjs           # monorepo watchFolders + NativeWind
└── babel.config.cjs
```

`android/` (the native project) is **generated, never committed** — see §9.

## 5 · The app-core seam (PlatformAdapter)

All business logic lives in `packages/app-core`; it never touches
window/document/localStorage. Each shell configures it once at boot via
`configureCore(adapter)` (`packages/app-core/src/adapter.ts`).

Android's adapter: `src/lib/core-adapter.ts` → `configureAndroidCore()`,
called at the top of `app/_layout.tsx` (module scope, StrictMode-safe):

| Adapter field     | Android implementation                                                                                                                                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `host`            | `"android"`                                                                                                                                                                                                                                         |
| `apiBaseUrl`      | baked `extra.apiBaseUrl` (CI `EXTRA_API_BASE`); dev-only `http://localhost:3000` over `adb reverse` (`__DEV__`); a release built without an override falls back to `extra.releaseApiBase` — the same origin the release QR intent filter advertises |
| `appVersion`      | expo-constants (`app.config.ts` version)                                                                                                                                                                                                            |
| `storage`         | MMKV instance id `ks-app-core` (synchronous — the offline engine's KV contract is sync)                                                                                                                                                             |
| token read/write  | expo-secure-store key `auth.sessionToken` (keystore encryption; never plaintext)                                                                                                                                                                    |
| `deviceLabel`     | `"Android"`                                                                                                                                                                                                                                         |
| `onNetworkChange` | NetInfo connectivity events                                                                                                                                                                                                                         |

Web/Electron counterpart: `apps/app/src/main/lib/platform.ts`
(`configureWebCore`, wired in `main.tsx`).

## 6 · Dev workflow

```bash
# terminal 1 — API
cd apps/app && bun run dev:server          # Hono on :3000

# terminal 2 — Android
cd apps/android
adb reverse tcp:3000 tcp:3000              # device localhost → machine :3000
bun run start                              # Metro
bun run android                            # install + launch the dev build
```

- Dev builds hit `http://localhost:3000` (via adb reverse). Release builds
  bake the deployed origin — CI normalizes `vars.APP_URL` to an absolute
  `https://` origin and passes it as `EXTRA_API_BASE`; `app.config.ts`
  stores it in `extra.apiBaseUrl`, `core-adapter.ts` reads it through
  expo-constants. A bare FQDN would build broken relative URLs.
- QR approval links use the custom `kataria://` scheme in dev and the release
  HTTPS origin's `/login/scan/<code>` path in production; both are registered
  in the native Android intent filters so camera taps route into Expo Router.
- Auth on dev: OTP or password as on web (see `apps/app/APP.md` §9).
- Metro needs the monorepo roots — `metro.config.cjs` watches the workspace
  root and resolves `node_modules` from both roots (Bun hoisting).
- NativeWind compiles `global.css` through Metro; Tailwind classes resolve
  at build time, colors come from the runtime palette (§8), not the
  Tailwind config.

## 7 · Updates & versioning

One release train with everything else: **`apps/app/package.json`
`version` is the single version for every platform.** `app.config.ts`
reads it; `versionCode = major*10000 + minor*100 + patch` (0.6.0 → 600) —
monotonic, Android rejects any update whose code doesn't rise. One bump
releases everywhere; CI publishes only when the version differs from the
published manifest.

Update flow (`src/lib/updates.ts` + `installer.ts`):

1. Poll `/releases/app/android/latest.json` (R2 `ks-releases`, served by
   the app worker; published by `scripts/publish-releases.ts`) — on launch
   and every 4 hours.
2. Newer version → non-blocking banner (`src/ui/update-surface.tsx`).
3. Server 426 `update_required` (below `minAppVersion`) → blocking dialog
   through app-core's `setUpdateRequiredHandler` — identical gate on every
   shell.
4. Install: APK streamed via expo-file-system into app-private storage
   (progress percent) → handed to the system package installer through a
   VIEW intent on the FileProvider content URI (expo-intent-launcher;
   expo-sharing is the fallback). `REQUEST_INSTALL_PACKAGES`; first install
   asks once for "install unknown apps".

Same signing identity as every previous install — the signature never
changes.

## 8 · Design tokens

`apps/app/design.md` is the design system — single source of truth for
every visual value (radius ladder, spacing, type, color).

- `scripts/convert-tokens.ts` converts `apps/app`'s `globals.css` palette
  (oklch) → `src/theme/tokens.ts` (sRGB hex/rgba — RN cannot parse oklch at
  runtime). **After any palette change in globals.css, run
  `bun scripts/convert-tokens.ts`** and commit the regenerated tokens.
- `src/theme/index.ts` exposes `usePalette()` — scheme (light/dark,
  `userInterfaceStyle: automatic`) + 6 accents. The default is `graphite`,
  the monochrome accent that mirrors apps/app's single neutral `--a-*`; the
  hues are opt-in from Settings → Appearance. `withAlpha()` tints a palette
  color safely (tokens are hex in light mode but `rgba()` in dark for
  `border`/`input`, so string concatenation would produce an invalid color);
  `SCRIM` is the one overlay scrim.
- `src/lib/theme.ts` owns the choice: a stored scheme wins, otherwise the OS
  scheme is followed live (`Appearance`); accent and scheme persist in the
  adapter's `uiStorage`, which is never wiped on logout. Both are edited in
  Settings → Appearance, and the status bar follows the resolved scheme.
  `initTheme()` runs at boot in `app/_layout.tsx` (idempotent), so the stored
  choice applies before the first paint.
- Status-bar inset: `Screen` clears the status bar itself
  (`useSafeAreaInsets`); tab screens that put a banner above the title pass
  `safeTop={false}` and inset their own wrapper. Screens that draw their own
  header — masters, colors, reports, and the returns / raw-material / packing
  editors — apply `insets.top` to their root view.
- `tailwind.config.js` mirrors the radius ladder (8/10/12/16/20px) and maps
  `font-mono` to Android's `monospace` (pairing codes, tabular figures);
  colors are NOT in the Tailwind config — components read the runtime
  palette. The Inter families are declared but never registered, so text
  currently renders in the platform font.
- `src/ui/kit.tsx` implements design.md §2.2–§2.4 exactly — controls 10px,
  cards 12px, badges 8px (soft tint + hairline), page titles 28px, pulsing
  skeletons, loading buttons that keep their label (no spinners). Mobile
  grammar adaptations are deliberate: bottom-sheet pickers instead of
  popovers, native confirm dialogs, date fields as validated `YYYY-MM-DD`
  text.

## 9 · Continuous Native Generation (CNG)

The `android/` directory is **generated — never hand-edit, never commit
it.** It is produced by `bunx expo prebuild -p android` from
`app.config.ts` + `plugins/`:

- `plugins/with-signing.ts` — CI decodes `ANDROID_KEY_BASE64` into
  `android/keystore.properties`; the plugin wires that file into the
  release buildType so `assembleRelease` signs the APK. Local builds
  without the file keep Expo's debug signing.
- Regenerate after any config/plugin change: `bun run prebuild`.
- CI (`pipeline.yml` android job): Bun install → `expo prebuild -p android
--no-install` on the runner → decode keystore → write
  `keystore.properties` → `gradle assembleRelease` → artifact
  `ks-biz-app-android` → release + `publish-r2` jobs (unchanged paths).

Secrets (repo-level, owner-only): `ANDROID_KEY_BASE64` / `ANDROID_KEY_ALIAS`
/ `ANDROID_KEY_PASSWORD`, plus the `APP_URL` variable. Losing the keystore
means uninstall/reinstall on every device — keep it durable outside GitHub.

## 10 · Permissions

| Permission                 | Why                                               |
| -------------------------- | ------------------------------------------------- |
| `INTERNET`                 | API + release downloads                           |
| `CAMERA`                   | QR login + device approval scanning (expo-camera) |
| `REQUEST_INSTALL_PACKAGES` | in-app APK self-update via the system installer   |

Transitive config plugins would otherwise merge in `RECORD_AUDIO`,
`SYSTEM_ALERT_WINDOW` and external-storage access — `android.blockedPermissions`
in `app.config.ts` strips them, so the shipped manifest carries exactly the
three above. `android.allowBackup` is `false`: offline challans, masters and the
company profile are business data and must not ride Android's cloud or
device-transfer backups.

## 11 · PDFs & printing

The server renders the PDF (Cloudflare Browser Run) — same template, same
Inter inlining, visually identical output on every shell
(`apps/app/APP.md` §12). This shell:

- `src/lib/pdf.ts` downloads `/api/challans/:id/pdf` with the persisted
  bearer + device headers into app-private storage.
- Output paths: Android share sheet (expo-sharing — save to Drive,
  WhatsApp, etc.) or the Android print framework (expo-print →
  PrintManager).

No local HTML rendering — offline PDF needs the server, like web/PWA
(Electron is the only shell that renders locally).

## 12 · Offline & sync

Same engine as every shell: `packages/app-core/src/offline/` — cached
masters + counters, outbox (`pending | conflict | error`), `clientRef`
idempotency, single-flight 3-pass sync (boot, `online` event via NetInfo,
30 s interval, manual retry), conflict resolution with the server's
suggested number (`SyncBanner` / `SyncSheet` in `src/ui/sync.tsx`),
logout wipe. Persistence rides the adapter's MMKV storage. Full contract:
`apps/app/APP.md` §11.

## 13 · Pointers

- `apps/app/APP.md` — domain, database, API, auth, permissions, infra.
- `apps/app/design.md` — design system (tokens this app mirrors).
- `packages/app-core/src/adapter.ts` — the seam contract.
