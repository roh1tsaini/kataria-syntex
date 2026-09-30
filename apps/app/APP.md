# apps/app — product reference

Business app for Kataria Syntex. Facts here are verified against code —
update this doc in the same change as the code. Current state only.

**Owns:** database, API, auth, platforms, updates, infra facts, caching,
offline reachability for this app.
**Does not own:** design values (`design.md`) · ops/CI/secrets/backups
(`DEPLOY.md`) · agent rules (`AGENTS.md`) · repo layout (`README.md`).

Contents: 1 What it is · 2 Tech stack · 3 Source map · 4 Commands ·
5 Platforms (5.1 per-shell, 5.2 Android project, 5.3 update mechanisms) ·
6 Database · 7 API · 8 Auth & security · 9 Offline & reachability ·
10 App UI · 11 Infra facts · 12 Updates & versioning · 13 Caching ·
14 Dev & test · 15 Pointers.

---

## 1 · What it is

**Overview**

- Internal business app shell for Kataria Syntex.
- One SPA bundle, three shells — web, Electron desktop, Android WebView
  (contract in Section 5).
- Backend — Hono on Cloudflare Workers + D1 (SQLite).
- Shared core — `packages/app-core` (API client, auth store, network
  reachability, data cache registry).
- Signed-in users land on an empty home screen inside `AppShell` (`/`), with
  navigation to Connected Devices (`/devices`) and Settings (`/settings`).

## 2 · Tech stack

| Layer        | Tech                                                   |
| ------------ | ------------------------------------------------------ |
| Frontend     | React 19, Vite 8, Tailwind v4, Zustand                 |
| UI           | shadcn/ui-style primitives (`ui/components/ui/*`)      |
| Icons        | lucide-react (UI) + inline brand glyphs                |
| Desktop      | Electron 43, electron-builder                          |
| Android      | Capacitor 8 (`apps/android` — the shell project)       |
| Backend      | Hono 4 on Cloudflare Workers (`nodejs_compat`)         |
| DB           | D1 (SQLite) via Drizzle ORM (`drizzle-orm@1.0.0-rc.4`) |
| Auth         | OTP (Pingram) + password + QR pairing, HttpOnly/Bearer |
| Icons/assets | sharp                                                  |
| Toolchain    | Bun 1.4.2 + Turborepo                                  |

## 3 · Source map

```
apps/app/
├── src/
│   ├── server/                  # API (workers runtime)
│   │   ├── worker.ts            # Worker entry: /api/*, /releases/* → Hono, else → assets
│   │   ├── index.ts             # Hono app: logger, secureHeaders, CORS, routes
│   │   ├── env.ts               # Env bindings type
│   │   ├── db/schema.ts         # 7 auth tables (Drizzle)
│   │   ├── auth/                # session, otp, qr-login
│   │   ├── routes/              # auth, auth-otp, auth-password, auth-qr, auth-session, auth-shared, health
│   │   └── lib/                 # version-gate, releases, rate-limit, password, pingram…
│   └── main/                    # SPA (web + electron + android share it)
│       ├── lib/platform.ts      # host detection + configureWebCore (app-core seam)
│       ├── lib/lazy-route.ts    # route chunk loader with stale-chunk reload
│       ├── store/updates.ts     # update state (deploys, 426 gate, progress)
│       └── ui/                  # App.tsx routes, pages/, components/, globals.css
├── electron/                    # main.ts (keychain, net bridge, updater), preload, build
├── drizzle/                     # migrations (timestamped folders)
├── design.md                    # design system — read before any UI change
└── wrangler.jsonc               # Worker + assets + D1 + R2 config

packages/app-core/               # shared business core (all shells)
├── src/adapter.ts               # PlatformAdapter seam — configureCore()
└── src/{api,id,network,progress,toast,data-caches,errors,store/auth,offline/*}

packages/shared/src/             # pure shared data & validation — no platform imports
└── index.ts, cn.ts, errors.ts, format.ts, products.ts, releases.ts, semver.ts, shades.ts, validation.ts
```

## 4 · Commands

```bash
bun run dev               # Vite :1420 (strict port, proxies /api → :3000)
bun run dev:server        # wrangler dev :3000 (workerd + local D1)
bun run electron:dev      # Electron shell over the Vite dev server
bun run db:generate       # drizzle-kit generate (new migration)
bun run db:migrate:local
bun run icons             # regenerate app icons (sharp)
bun run electron:package  # build + build:electron + electron-builder
```

**Build notes**

- `electron:package` — CI inlines the same steps in `pipeline.yml`; keep
  both spellings in sync.
- `build:electron` also runs solo mid-pipeline to inject `APP_URL`.
- `release/` (400MB+ binaries) is excluded from `turbo.json` outputs —
  CI artifacts, never cached.
- Done = typecheck + lint + format + build green from repo root AND the
  feature works when run.
- Web, Electron and Android compile as one renderer bundle; `apps/android`
  typechecks and syncs (`bunx cap sync android`) against `packages/app-core`.

## 5 · Platforms

**Shell matrix**

- One bundle, three shells (`AGENTS.md` Section 2.3): `apps/app` (web +
  Electron) + `apps/android` (Capacitor 8 WebView over the same built bundle
  at the `≤sm` breakpoint).
- No separate Android UI — a UI/feature change is a web change; it lands on
  Android by rebuilding + `bunx cap sync android`.
- UI verification happens once in the browser at the `≤sm` breakpoint.
- iOS is out of scope — never scaffold for it.
- Build targets (owner-fixed): Android universal APK · Windows x64 ·
  macOS arm64 dmg (Apple Silicon only) · Linux x64 AppImage.
- Platform branches live ONLY in `src/main/lib/platform.ts` behind
  `detectHost()`. A platform `if` anywhere else is a bug.

| Shell   | Stack                                 | Session storage                   |
| ------- | ------------------------------------- | --------------------------------- |
| Web     | browser, revalidated HTML             | HttpOnly cookie                   |
| Desktop | Electron 43, `app://` custom protocol | OS keychain via IPC + safeStorage |
| Android | Capacitor 8 WebView                   | `@capacitor/preferences`          |

### 5.1 · Per-platform behaviour

**Shell differences**

- **Web** — session cookie; updates apply on next navigation (HTML always
  revalidated, only content-hashed assets immutable). A lazy chunk gone
  stale after a deploy reloads the page once (`lib/lazy-route.ts`), then
  the ErrorBoundary takes a second failure.
- **Desktop** — Electron `app://` handler sets explicit cache headers
  (custom protocols cache against the URL otherwise); updates stage
  silently and install on quit (Windows/Linux); macOS has no silent
  install — its dmg banner is the one non-blocking update announce.
- **Android** — `apps/android` wraps the same bundle at `https://localhost`,
  so the API origin is baked in at build (`VITE_API_URL`);
  `apps/android/scripts/build-web.ts` fails the build if missing and
  `platform.ts` throws at boot (`bakedApiOrigin`). Boot compares the native
  `versionName` with the executing bundle (`reloadOnStaleAndroidBundle`) so
  a replaced APK never runs a stale bundle.

**Logged-out entry (web only)**

- `/` unauthenticated → two-path entry screen (`ui/pages/entry.tsx`):
  Sign in / Install for the detected OS.
- `/download` — all four installers (paths from the published manifest,
  brand glyphs `ui/components/brand-icons.tsx`) with a "This device"
  recommendation.
- Signed-in users never see it; native shells redirect `/` and `/download`
  to `/auth`.

### 5.2 · Android native project

**Gradle & manifest**

- `apps/android/android/` is a committed Capacitor Gradle project — native
  config only (manifest permissions, signing, ABI filters), never UI.
- `cap sync` copies the built bundle and the plugin list into it.
- `app/build.gradle` reads `apps/app/package.json` for `versionName` and
  derives `versionCode = major*10000 + minor*100 + patch`.
- ARM-only: `abiFilters 'armeabi-v7a', 'arm64-v8a'`.
- `manifestPlaceholders.APP_HOST` comes from `-PAPP_HOST` (CI passes the
  bare FQDN from `vars.APP_URL`; local builds default to `localhost`). The
  same value is a `buildConfigField` the installer plugin pins downloads to.
- Release artifact is named `Kataria-Syntex-Biz-App-<version>.apk` so
  immutable HTTP caches never serve a previous release's bytes.
- `AndroidManifest.xml` sets `allowBackup="false"` and requests three
  permissions: `INTERNET` (API calls), `CAMERA` (QR login + device-approval
  scan), `REQUEST_INSTALL_PACKAGES` (in-app APK self-update).
- Play Protect "App scan recommended" appears on first sideload of each new
  version per device; tap "Scan app" once per device.
- Signing reads `keystore.properties` written by CI from
  `ANDROID_KEY_BASE64` / `ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD`.
- Plugins: official `@capacitor/*` set plus local `InstallerPlugin.kt`
  (streams APK to app-private `updates/` cache, verifies SHA-256 against the
  manifest, fires `FileProvider` `ACTION_VIEW`).
- Commands in `apps/android`: `bun run sync` (build `apps/app` + `cap sync
android`), `bun run build:apk` (adds `gradlew assembleRelease`), `bun run
open` (Android Studio).

### 5.3 · Update mechanisms

| Surface   | Check                                       | Channel                              | UI                                                                                        |
| --------- | ------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| Web       | navigation                                  | revalidated HTML                     | silent — next navigation runs the fresh build; a deploy floor reloads once silently first |
| Win/Linux | launch + 30-min interval (electron-updater) | R2 `latest.yml` / `latest-linux.yml` | silent download → dock badge (installs on quit; no in-app surface)                        |
| macOS     | launch (manifest) + hourly interval         | R2 `latest.json` (`mac` key)         | windowed in-app banner — manual `.dmg` install                                            |
| Android   | launch + 4h interval                        | R2 `latest.json` (`android` key)     | silent background staging → one system notification per release → Settings action         |
| Server    | per request (version floor)                 | `426 update_required`                | undismissable `update-dialog.tsx` — host-appropriate action                               |

**Principles**

- Every check is silent until there is a user action with a finish line.
- One surface per severity: background apply (web) → dock badge (win/linux) →
  system notification + Settings row (Android) → non-blocking banner (macOS
  dmg) → blocking dialog (server floor).
- Desktop never auto-installs a visible restart — downloads stage in the
  background and install on quit (Windows/Linux) or manual dmg swap (macOS).
- Web has no UI for routine deploys; revalidated HTML picks up the new build
  on next navigation.
- The 426 dialog action leads somewhere installable on every host.
- Deep links (Android): `kataria://` and `https://<origin>/login/scan/<code>`
  are routed by `initAndroidDeepLinks()`.
- Network + lifecycle events: web/Electron read `window` online/offline and
  `visibilitychange`; Android reads `@capacitor/network` and `@capacitor/app`
  `appStateChange`.
- Android bundle self-heal: `reloadOnStaleAndroidBundle()` compares native
  `versionName` with `__APP_VERSION__` and reloads once if mismatched.
- Electron window chrome: `desktopWindow()` exposes minimize/maximize/close
  and the resolved theme background; one instance per installation; zoom
  locked; camera granted to app origins for QR scan; packaged renderer served
  at `app://bundle/` with SPA deep-link fallback.

## 6 · Database

**Schema & migrations**

- D1 (SQLite). Schema: `src/server/db/schema.ts` (7 tables).
- Migrations: `drizzle/` (generated by `bun run db:generate`).
- Apply migrations: `wrangler d1 migrations apply ks-biz-app-db` (CI applies
  before deploy; `bun run db:migrate:local` locally).
- Multi-statement invariants run inside a transaction with the sync `.run()`
  pattern (`db.batch()` = one atomic transaction).
- Local D1: `.wrangler/state/v3/d1/…sqlite` (plain SQLite).
- Export off the platform: `wrangler d1 export` (`DEPLOY.md`).

| Table            | Purpose                                                         |
| ---------------- | --------------------------------------------------------------- |
| `users`          | one row per person (unique email/phone, optional password hash) |
| `devices`        | paired desktop/Android/web devices per user                     |
| `sessions`       | auth sessions (token hash, device link, expiry)                 |
| `otp_codes`      | login OTPs (single-use, 5-min TTL, attempt counter)             |
| `login_attempts` | per-identifier + IP attempt history for rate-limiting           |
| `qr_logins`      | short-lived QR login codes (10-min TTL, single-use claim)       |
| `rate_limits`    | per-key request budgets                                         |

## 7 · API

Hono app mounted on `/api/*` (`src/server/index.ts`).

| Topic            | Rule                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Responses        | 200/201/304; errors `{ error: "<snake_code>" }` — shared codes in `packages/shared/errors.ts`, copy in `packages/app-core/errors.ts` (`friendlyError`) |
| Request IDs      | `crypto.randomUUID` on every response; global error handler logs + 500 without leaking internals                                                       |
| CORS             | native shells built in (`app://bundle`, capacitor origins); `CORS_ORIGIN` env adds third-party origins                                                 |
| Security headers | CSP, nosniff, DENY frame, no referrer, strict permissions policy (camera on for app origins — QR scan needs it)                                        |
| Caching          | every `/api/*` response carries `Cache-Control: no-store`                                                                                              |
| Version gate     | `src/server/lib/version-gate.ts`; `/api/auth/*` and `/api/health` stay reachable under a floor so the update UI and sign-in work                       |
| Rate limits      | per-route buckets on auth + OTP (JSON 429 with the code)                                                                                               |

**Routes (`src/server/routes/`)**

| Route                                                                        | What                                       |
| ---------------------------------------------------------------------------- | ------------------------------------------ |
| `auth` (+ `auth-otp`/`auth-password`/`auth-qr`/`auth-session`/`auth-shared`) | lookup, OTP, password, QR login, sessions  |
| `health`                                                                     | `GET /api/health` and `GET /api/health/db` |

## 8 · Auth & security

| Method    | Web | Desktop | Android |
| --------- | --- | ------- | ------- |
| Email OTP | ✓   | ✓       | ✓       |
| Phone OTP | ✓   | ✓       | ✓       |
| Password  | ✓   | ✓       | ✓       |
| QR login  | ✓   | ✓       | ✓       |

| Topic               | Rule                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| Session             | opaque token in HttpOnly cookie (web) / `Authorization: Bearer` (native); 30-day TTL             |
| QR login            | 10-min TTL codes in `qr_logins`; single-use CAS claim                                            |
| OTP delivery        | Pingram API — `https://api.pingram.co` (worker secret `PINGRAM_API_KEY`)                         |
| OTP expiry          | 5 min; 3 verify attempts per code (CAS update)                                                   |
| OTP resend cooldown | 30 s per identifier (429 `otp_resend_cooldown`)                                                  |
| OTP daily caps      | 5/hr and 12/day per identifier · 10 per IP per 15 min · 300 global/day (`OTP_DAILY_BUDGET`)      |
| Password            | optional PBKDF2-SHA256 (100k iterations, min 10 chars); dummy-hash on missing user               |
| Desktop session     | OS keychain via safeStorage IPC — never a plain file                                             |
| Android session     | `@capacitor/preferences` KV (scoped to the app)                                                  |
| Desktop logout      | wipes native keychain + `localStorage` + `sessionStorage`                                        |
| Devices management  | `/devices` and Settings → Devices list active sessions with current marker and per-device revoke |

**Flow**

- `/auth` → enter phone/email (`POST /api/auth/lookup`) or scan QR code
  (`POST /api/auth/qr/start`).
- Existing user → OTP sent (`POST /api/auth/otp/request`), verify code
  (`POST /api/auth/otp/verify`) or switch to password (`POST
/api/auth/password/login`).
- New user → collect name + optional password (`CreateStep`), send OTP,
  verify OTP → `POST /api/auth/signup`.
- Dev user — phone `+91 63515 70979`, OTP-only, no password.

## 9 · Offline & reachability

| Piece        | Behaviour                                                                                                               |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Session boot | `useAuth.bootstrap()` falls back to the cached user snapshot when `/auth/me` fails with a net error                     |
| Reachability | `Network.getStatus()` (native) / `navigator.onLine` + `online`/`offline` events (web) — one adapter                     |
| 401 handling | any 401 wipes client caches (`invalidateDataCaches`) and cached session snapshot (`clearSessionCache`), resets to guest |
| Banner       | `OfflineBanner` shows a persistent warning strip while `useSync.online` is `false`                                      |

## 10 · App UI

**UI contract**

- Design system — `design.md` (single source of truth; read before any UI
  change, extend it before inventing a value).
- One bundle, one UI — Android renders this same bundle at the `≤sm`
  breakpoint.
- Route-level code splitting (`React.lazy` + `lib/lazy-route.ts`) keeps
  the entry lean; a stale chunk reloads once, then the ErrorBoundary.
- Loading — skeleton shimmer blocks shaped like the content, no spinners
  (`design.md` Section 3.1).
- Errors/toasts — copy via `friendlyError`.
- Update surfaces (banner, dialog, entry screen) — visual contract in
  `design.md` Section 3.3–3.4; behaviour in Section 5.3.

## 11 · Infra facts

| Piece    | Choice                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Worker   | one worker: static SPA + Hono API + `/releases/*` object serving (`run_worker_first` on both dynamic prefixes, so no static file can shadow them) |
| Database | D1 `ks-biz-app-db`                                                                                                                                |
| Releases | R2 `ks-releases` bucket — installers, APK, update manifests under `app/`, served publicly at `/releases/*`                                        |
| Hostname | `app.katariasyntex.workers.dev` — custom domain parked (no purchase)                                                                              |

| Binding / var       | What                                                   |
| ------------------- | ------------------------------------------------------ |
| `DB`                | D1 binding                                             |
| `ASSETS`            | Worker static assets                                   |
| `RELEASES`          | R2 release bucket (`/releases/*` serving)              |
| `CORS_ORIGIN`       | extra third-party origins (native shells are built in) |
| `APP_ENV`           | `development` → error detail in responses              |
| `PINGRAM_API_KEY`   | OTP sender (secret)                                    |
| `OTP_DAILY_BUDGET`  | global daily OTP send ceiling (default 300)            |
| `TRUST_PROXY`       | `1` → trust rightmost XFF (behind a proxy)             |
| `VITE_API_URL`      | native builds → deployed API origin                    |
| `VITE_PROXY_TARGET` | dev proxy target (default `localhost:3000`)            |

**Free-tier limits** (Cloudflare — re-verify before claiming; limits change)

| Service | Limit                                                                      |
| ------- | -------------------------------------------------------------------------- |
| Workers | 100k requests/day · 10 ms CPU/invocation                                   |
| D1      | 500 MB · 5M reads + 100k writes/day · Time Travel 7 days                   |
| R2      | 10 GB · Class B 10M/mo · Class A 1M/mo · egress free (~400 MB/release set) |
| Pingram | PAID per SMS/email — the only cost line; OTP ceilings exist because of it  |

## 12 · Updates & versioning

**Version floor & manifest**

- Single source of truth: `apps/app/package.json` — `version` (this release)
  and `minAppVersion` (breaking-change floor; `0.0.0` = gate off).
- Bumping `version` IS the release action — CI publishes only when it differs
  from the published manifest.
- The server answers `426 update_required` to any client whose
  `X-App-Version` is below `minAppVersion` (`src/server/lib/version-gate.ts`).
- A floor applies only to a client below it (`floorAppliesTo` in
  `packages/shared/src/semver.ts`).
- CI guards satisfiability: the gate job fails when `minAppVersion >
version`, and `deploy-app` runs after `publish-r2` when a release is being
  published.
- Manifest `app/android/latest.json` carries `version`, `minVersion`,
  `releasedAt`, per-platform paths, and the APK's `sha256`/`size`.

## 13 · Caching

| Layer                 | Owner / file                                         | Policy                                                                                                                                      |
| --------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP — static         | `public/_headers` (deployed into `dist/` by Vite)    | `index.html` + unhashed files: `max-age=0, must-revalidate`. Hashed `/assets/*`: `max-age=31536000, immutable`.                             |
| HTTP — API + releases | `src/server/index.ts` middleware · `lib/releases.ts` | Every `/api/*` response: `Cache-Control: no-store`. Release manifests `max-age=60`; versioned artifacts `immutable`.                        |
| Client data           | `packages/app-core/src/data-caches.ts`               | Registered client caches (`invalidateDataCaches`) + cached auth user snapshot (`clearSessionCache`) are wiped on logout/401/account switch. |

## 14 · Dev & test

- Local D1 — `.wrangler/state/v3/d1/…sqlite` (plain SQLite, readable);
  `bun run db:migrate:local` applies migrations.
- Local workerd verifies — `/api/health`, `/api/health/db`, SPA serving,
  JSON 404s, migrations.
- OTP testing budget — limits in Section 8; an identifier at the daily cap
  is locked out until the oldest row ages out (24 h).
- Dev user — phone `+91 63515 70979`, no password, OTP-only.
- QR login needs a second logged-in device (any camera) to approve.
- Dev logs (`api*.log`) are throwaway and gitignored — never commit them.

## 15 · Pointers

- `design.md` — design system (mandatory read for UI work).
- `DEPLOY.md` — pipeline, first-time setup, secrets, backups, releases.
- `AGENTS.md` — working rules, parity protocol, verification gates.
