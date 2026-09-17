# APP.md — apps/app reference (maintained)

Single maintained doc for the business app. Kept current with the code —
**code is truth**; update this doc in the same change that updates code.

**Maintaining rules**

- Change code → change this doc in the same commit. No stale lines.
- New table/route/permission/limit → add a row. Removed thing → delete the row.
- Numbers here are verified against constants in code. When they disagree,
  fix the doc or the code — never let both drift.
- Current state only: describe what IS. No past talk, no change history.

Contents: 1 What this is · 2 Monorepo (+ source map) · 3 Tech stack ·
5 Platforms (5.1 per-platform behaviour, 5.2 Android project, 5.3 update
mechanisms) · 6 Domain · 7 Database · 8 API · 9 Auth · 10 Permissions ·
11 Offline (reads) · 12 Realtime · 13 PDFs · 14 App UI · 15 Infra & deploy ·
16 Updates & versioning · 17 Caching · 18 Dev & test · 19 Pointers.
(There is no Section 4: the source map lives under Section 2.)

---

## 1 · What this is

Internal app for Kataria Syntex (yarn dyeing + trading):
sales challans, job-work challans + returns, raw material purchase,
packing, stock ledger, reports, color recipes.

One SPA bundle, three shells — behaviour contract in Section 5. Backend =
Hono on Cloudflare Workers + D1 (SQLite); shared business core =
`packages/app-core` (API client, stores, offline read cache + network
reachability).

```
purchase → job-work OUT (dyeing) → return → packing → sales challan
grey rolls    grey cones             dyed      packed    invoice
```

- Every document writes the `stock_entries` ledger.
- No money anywhere — movement papers only.
- Rolls cut to cones in-house: not tracked.

## 2 · Monorepo

Bun workspaces + Turborepo. Bun is the only package manager (`bun@1.4.2`).

| Path                | Role                                                  |
| ------------------- | ----------------------------------------------------- |
| `apps/app`          | Business app — web + Electron (this doc)              |
| `apps/android`      | Android app — Capacitor shell over this bundle        |
| `apps/web`          | Public website — Next.js + Vinext on Workers          |
| `packages/app-core` | Shared business core — API client, stores, read cache |
| `packages/shared`   | Domain types, permissions, errors, numbering, FY      |
| `packages/tsconfig` | Shared TS presets                                     |

### Commands

```bash
bun install
bun run dev           # all dev servers
bun run build         # gate — production build
bun run typecheck     # gate
bun run lint          # gate
bun run format:check  # gate

# inside apps/app
bun run dev            # Vite :1420 (strict port, proxies /api → :3000)
bun run dev:server     # wrangler dev :3000 (workerd + local D1)
bun run electron:dev   # Electron shell over the Vite dev server
bun run db:generate    # drizzle-kit generate (new migration)
bun run db:migrate:local
bun run icons          # regenerate app icons (sharp)
bun run electron:package
```

Packaging notes (local-only helpers — CI inlines the same steps in
`pipeline.yml`, so keep both spellings in sync when the flow changes):

- `electron:package` = `build` + `build:electron` + `electron-builder`.
  `build:electron` is also run solo mid-pipeline to inject `APP_URL`.
- `release/` (400MB+ unpacked binaries) is intentionally excluded from
  `turbo.json` build outputs — shipped as CI artifacts, never cached.

**Done** = typecheck + lint + format + build green from repo root
AND the feature works when run. Web, Electron and Android compile as one
renderer bundle; `apps/android` typechecks and syncs (`bunx cap sync android`)
against the same `packages/app-core`.

### Source map

```
apps/app/
├── src/
│   ├── server/                  # API (workers runtime)
│   │   ├── worker.ts            # Worker entry: /api/* → Hono, else → assets
│   │   ├── index.ts             # Hono app: logger, secureHeaders, CORS, routes
│   │   ├── env.ts               # Env bindings type
│   │   ├── db/schema.ts         # 30 tables (Drizzle)
│   │   ├── auth/                # session, otp, qr-login, perms, members
│   │   ├── routes/              # thin: parse → lib module → JSON
│   │   ├── realtime/            # RealtimeRoom DO + publish helper (fan-out only)
│   │   └── lib/                 # document-pipeline, stock, password, pingram…
│   ├── main/                    # SPA (web + electron share it)
│   │   ├── lib/platform.ts      # host detection + configureWebCore (app-core seam)
│   │   ├── lib/challan-pdf.ts   # challan PDF fonts + save/print
│   │   ├── store/updates.ts     # update state (deploys, 426 gate, progress)
│   │   └── ui/                  # App.tsx routes, pages/, components/, globals.css
│   └── shared/                  # challan-html template + Inter TTFs
├── electron/                    # main.ts (keychain, net bridge, printToPDF), preload, build
├── drizzle/                     # migrations (timestamped folders)
├── design.md                    # design system — read before any UI change
└── wrangler.jsonc               # Worker + assets + D1 + DO (realtime) config

packages/app-core/               # shared business core (all shells)
├── src/adapter.ts               # PlatformAdapter seam — configureCore()
├── src/api.ts                   # api(), ApiError, apiBlob, deviceHeaders, clientId
├── src/realtime.ts              # WebSocket change bus — useRealtime, useRealtimeEvent
├── src/store/                   # zustand: auth, challans, masters, recipes
├── src/offline/                 # read caches + network reachability state
├── src/network.ts               # useNetworkState — online/offline signal
├── src/errors.ts                # friendlyError
├── src/toast.ts                 # configureToasts sink
└── src/data-caches.ts           # registerDataCache / invalidateDataCaches
```

Request path:
SPA → same-origin `/api/*` (Vite proxy in dev) → Worker → Hono
→ `requireAuth` → `resolveMember` → `requirePermission` → lib module → D1.

## 3 · Tech stack

Latest stable majors; never downgrade to escape a break.

| Layer       | Tech                                                                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend    | React 19 · react-router-dom 7 · zustand 5 · Vite 8 (SWC) · TS 7 (strict)                                                                            |
| Styling     | Tailwind v4 · Radix primitives (shadcn pattern) · motion 12 · sonner 2                                                                              |
| API         | Hono 4 · zod 4 at every boundary                                                                                                                    |
| Data        | Drizzle ORM + drizzle-kit · Cloudflare D1                                                                                                           |
| Realtime    | Durable Objects (SQLite class, no storage used) — WebSocket fan-out per workspace                                                                   |
| PDF         | shared HTML template → Chromium: Browser Run (server) + printToPDF (desktop)                                                                        |
| Desktop     | Electron 43 · electron-builder 26                                                                                                                   |
| Shared core | `@kataria-syntex/app-core` — API client, zustand stores, offline read cache + network reachability (web + Electron here, Android in `apps/android`) |
| Android     | `apps/android` — Capacitor 8 shell loading this bundle (official `@capacitor/*` plugins)                                                            |
| QR          | qr-code-styling (show: rounded dots, extra-rounded eyes) · jsqr (scan) · input-otp                                                                  |
| CI          | GitHub Actions (`pipeline.yml`: gate → deploy + desktop + android → R2)                                                                             |

## 5 · Platforms

Platform differences live in each shell's `PlatformAdapter`
(`packages/app-core/src/adapter.ts` — the seam where the business core
meets its host: API base, token storage, cache KV, network events,
realtime origin, foreground events, optional Electron transport). This
app configures it via `configureWebCore()` in `src/main/lib/platform.ts`
(wired in `main.tsx`); the Android branch of the same file
(`detectHost() === "android"`) configures it for the Capacitor shell.
Never branch on platform elsewhere.

| Shell    | Session storage                          | API origin                                                          |
| -------- | ---------------------------------------- | ------------------------------------------------------------------- |
| Web      | HttpOnly cookie                          | same-origin `/api/*` (Vite proxy in dev)                            |
| Electron | OS keychain via safeStorage (`kc:*` IPC) | `APP_URL` injected by `build:electron` at build time                |
| Android  | `@capacitor/preferences` (bearer token)  | `VITE_API_URL` baked by CI; dev `localhost:3000` over `adb reverse` |

Build targets (fixed by owner):

- Android — universal APK (`assembleRelease`, built by CI from `apps/android`)
- Windows — NSIS x64
- macOS — dmg arm64 (Apple Silicon only)
- Linux — AppImage x64
- **iOS skipped — never build or scaffold for it.**

Electron renders challan PDFs locally via `kc:render-pdf` (printToPDF);
Android fetches the server-rendered PDF and opens the system share sheet
via `@capacitor/filesystem` + `@capacitor/share` — see Section 5.1 and Section 13.

### 5.1 · Per-platform behavior

Every genuine difference between the shells, one bullet per behaviour. Each
holds for all three platforms in the same line. If a behaviour is not here,
the shells do it identically.

- **Login** — web/electron offer QR as the primary path with OTP/password as
  fallback; Android is OTP/password only, because a phone cannot scan its own
  screen. The QR panel renders on `isPlainBrowser()`; native shells fall
  through to the identifier form (`ui/pages/auth.tsx`).
- **Challan PDF output** — web/desktop call `window.print()` on a print page
  (`ui/pages/challans-print.tsx`); Android shares the server-rendered PDF
  through the system share sheet (`shareChallanPdfOnAndroid`), because no
  maintained Capacitor plugin prints a file. The button reads "Share / Save
  PDF" on Android, "Print / Save as PDF" elsewhere; the print page's
  auto-fire (350 ms after load) is skipped on Android so a sheet never opens
  unprompted. Electron additionally renders offline via `kc:render-pdf`.
- **Session storage** — web keeps the session in an HttpOnly cookie; Android
  in `@capacitor/preferences` under `auth.token.v1`; Electron in the OS
  keychain via `safeStorage` through the `kc:*` IPC bridge.
- **Settings surface** — one component, two presentations, decided by
  the `md` breakpoint and never by host: desktop web and Electron render
  `/settings` (Appearance, Updates, Devices) as a large top-anchored window
  over a blurred app (`settings-window.tsx`) with a left settings nav and the
  selected detail on the right; phone web and the Android WebView render the
  same content stacked as a full page. Closing the window navigates back, so
  `/settings` never leaves an empty content area; `/settings` as the launch
  URL falls back to home because there is no history to pop. Company profile,
  numbering and financial years live under Masters as the Company tab.
- **Offline KV** — web/Electron use `localStorage` (`offline.*.v1` keys);
  Android uses `@capacitor/preferences` behind a session map
  (`androidMemory`) because Preferences is async and the offline engine reads
  synchronously. `hydrateAndroidStorage()` runs once from `main.tsx` before
  the first render so the store is warm at first paint.
- **Routine updates** — web applies a deploy with no prompt and no worker:
  index.html revalidates on every navigation, so the next load, reload, or
  reopen runs the fresh build; Windows/Linux download
  silently and install on quit; macOS shows a title-bar banner for the dmg;
  Android announces each newer release once with a system notification (tap →
  Settings) and exposes the APK install in Settings. Only a server
  `426 update_required` floor blocks (`update-dialog.tsx`).
- **Deep links** — Android only. `kataria://` and `https://<origin>/login/scan/<code>`
  are registered as intent filters in `AndroidManifest.xml` and routed by
  `initAndroidDeepLinks()` (wired before first render so a cold-start link
  sets the initial location). `autoVerify="false"` — App Links would need an
  `assetlinks.json` hosted on the web origin, which does not exist; until it
  ships, Android may show a chooser for a login link.
- **Network + lifecycle events** — web/Electron read `window` online/offline
  and `visibilitychange`; Android reads `@capacitor/network` and
  `@capacitor/app` `appStateChange` (a backgrounded socket dies; foreground
  drives the reconnect).
- **Realtime origin** — same-origin web derives the WS origin from the page;
  Android and Electron use the baked `VITE_API_URL` because their page origin
  is the local bundle, not the API.
- **Android bundle self-heal** — an APK install does not invalidate the
  WebView's cached bundle, so the app can boot running the build just
  replaced, which also breaks the `X-App-Version` handshake.
  `reloadOnStaleAndroidBundle()` compares the native `versionName`
  (`App.getInfo()`) with the baked `__APP_VERSION__` and reloads once with a
  version query; one attempt per WebView session (`sessionStorage`).
- **Electron window chrome** — `desktopWindow()` exposes minimize/maximize/
  close and the resolved theme background; web has no window chrome.

Desktop shell notes: one instance per installation (second launch focuses
the first), no menu bar in packaged Windows/Linux builds, pinch/ctrl-wheel
zoom locked, camera granted to app origins for QR scan/approve, packaged
renderer served at `app://bundle/` with SPA deep-link fallback, and the
document never scrolls — routed content scrolls in
`.app-scroll` under the custom title bar so the window controls sit flush
against the window edge (see design.md Section 2.7.1).

### 5.2 · Android native project

`apps/android/android/` is a committed Capacitor Gradle project — native
config only (manifest permissions, signing, ABI filters), never UI. `cap
sync` copies the built bundle and the plugin list into it.

- `app/build.gradle` — reads `apps/app/package.json` for `versionName` and
  derives `versionCode = major*10000 + minor*100 + patch` (monotonic;
  Android rejects an update whose code does not rise). ARM-only:
  `abiFilters 'armeabi-v7a', 'arm64-v8a'`. `manifestPlaceholders.APP_HOST`
  comes from the `-PAPP_HOST` gradle property (CI passes the same
  `vars.APP_URL` the bundle bakes as `VITE_API_URL`; local builds default to
  `localhost` so the manifest still merges).
- `AndroidManifest.xml` — `allowBackup="false"`: the cached masters and
  company profile are business data and must not ride Android's cloud or
  device-transfer backups. Three permissions: `INTERNET` (API calls),
  `CAMERA` (QR login + device-approval scan), `REQUEST_INSTALL_PACKAGES`
  (in-app APK self-update).
- Signing — `keystore.properties` is written by CI from the
  `ANDROID_KEY_BASE64` / `ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD` repo
  secrets and wired into the release build by `plugins/with-signing.ts`. A
  lost keystore means uninstall/reinstall on every device — keep the
  original `.p12` and its password somewhere durable outside GitHub.
- `InstallerPlugin.java` (native, registered in `MainActivity`, no npm
  package) — a WebView cannot fire the system package installer. The shared
  update store streams `manifest.android.apk` into app-private cache with
  byte progress as soon as the manifest poll finds a newer version — no
  Settings visit and no WiFi gate — then the plugin fires the installer via
  the FileProvider content URI. Android still requires that tap, so the
  download landing fires one notification; Settings keeps the action for
  anyone who dismissed it. First install asks once for "install unknown
  apps" (`REQUEST_INSTALL_PACKAGES`); denial surfaces the
  allow-in-settings copy in the blocking dialog.
- Baked-origin build requirement — the WebView serves the bundle from
  `https://localhost`, which is NOT the API. Without a baked origin every
  fetch resolves against the bundle origin, `/api/health` answers the SPA
  shell, the client classifies it as a network failure, and the app reads
  "offline / no internet" on a device with a perfect connection.
  `apps/android/scripts/build-web.ts` fails the build before a broken APK
  exists; `platform.ts` throws again at boot (`bakedApiOrigin`). Bake with
  `VITE_API_URL=<origin>`.
- Commands (`apps/android`) — `bun run sync` (build:web:apk + `cap sync
android`), `bun run open` (Android Studio), `bun run build:apk` (sync +
  `gradle assembleRelease`), `bun run typecheck` + `bun run lint` (gates).

**Logged-out entry flow (web only)**: unauthenticated visitors to `/` get
the two-path entry screen (`ui/pages/entry.tsx` — Sign in / Install for
<detected OS>); `/download` lists all four platform installers from the
published manifest with brand glyphs (`ui/components/brand-icons.tsx`) and
"This device" recommendation (detection is cosmetic, never load-bearing);
the login screen links to `/download`. Signed-in users never see the entry
screen. Native shells are unaffected.

### 5.3 · Update mechanisms

Behaviour contract per shell (no prompts, install-on-quit, APK in Settings)
is in the Section 5.1 bullets above. Mechanism detail — feed URLs, poll
intervals, the APK stream, the bundle self-heal — lives in the Section 16
table. This section states what differs; Section 16 states how it is
delivered.

## 6 · Domain: documents

Six modules. Counters live on the FY row, allocated by CAS retry
(lost race → 409 `challan_number_conflict`).

| #   | Document           | Captures                                                             | Writes                                              | Counter                              |
| --- | ------------------ | -------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------ |
| 1   | Raw material entry | supplier, challan no, denier/color, net kg, cones, packing, lot      | `raw_material_entries` + items                      | `rawNext`                            |
| 2   | Job-work challan   | job worker, denier, sacks, net kg, cones (no shade yet)              | `challans` (outward) + items                        | `outwardNext`                        |
| 3   | Job-work return    | job worker, free `invoiceNo`, items → outward challans, over-receipt | `job_work_returns` + items                          | — (free text)                        |
| 4   | Packing entry      | type `sale` (dyed) \| `job_work` (raw), sacks/cones, gross−tare      | `packing_entries` + items                           | `packingSaleNext` / `packingJobNext` |
| 5   | Sales challan      | customer, FY, auto number, items consume packing (exclusive)         | `challans` (sales) + items + `challan_item_sources` | `salesNext`                          |
| 6   | Color Organiser    | recipe per color + denier: ingredients (g/mg/custom), temp °C, time  | `color_recipes` + ingredients + versions            | —                                    |

Rules:

- Packing consumption is exclusive: `challan_item_sources` has a UNIQUE
  index on `packing_item_id` — one packed line can feed only one sale item.
- Job-work return items reference outward challans; over-receipt computed
  per challan (balance excludes the edited return itself).
- Recipe saves are versioned — last 5 snapshots kept, restore allowed.
- Masters: customers, job workers, suppliers, deniers — inline-add everywhere.
  Colors live under the Color Organiser (not Masters).
- Masters delete → 409 `in_use` while referenced.
- Challan delete → 409 while returns reference it (non-cascading FK).
- Challan type/FY never change via date edit.

**Numbering** (shared `formatChallanNumber`): `prefix + padded seq + suffix / FY short`
→ `CH/007/27`. Defaults: `CH/` `JW/` `PKG/S/` `PKG/J/` `RM/`, min 3 digits.
Per-workspace config JSON on the company row.

**Units**: kg + cones everywhere; sacks on job-work movement; Bags | Boxes +
count on raw material & packing; `lotNo` optional (purchase only);
gross − tare → net auto-calc, stays editable.
A yarn = denier (+ shade once dyed). Stock grouped denier × color × lot.

**Financial year**: Indian FY Apr 1 – Mar 31, computed in UTC, label
`2026-27`. FY rows created lazily on first document. Five counters per FY.

## 7 · Database — D1

Plain SQLite. Export with `wrangler d1 export` = zero lock-in.
Backups = D1 Time Travel (7 days). Migrations in `drizzle/*/migration.sql`,
applied by CI on deploy (`db:migrate:local` locally).

**30 tables** (Drizzle, `src/server/db/schema.ts`):

| Group               | Tables                                                                                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenancy & auth (11) | `workspaces` · `memberships` · `member_permissions` · `users` · `devices` · `sessions` · `otp_codes` · `login_attempts` · `qr_logins` · `invites` · `rate_limits`                   |
| Masters (10)        | `companies` · `financial_years` · `customers` · `job_workers` · `suppliers` · `deniers` · `colors` · `color_recipes` · `color_recipe_ingredients` · `color_recipe_versions`         |
| Documents (9)       | `challans` · `challan_items` · `job_work_returns` · `job_work_return_items` · `raw_material_entries` · `raw_material_items` · `packing_entries` · `packing_items` · `stock_entries` |

Conventions:

- IDs: UUID v4 text(36). Timestamps: ISO text. JSON: text columns.
- Snapshot columns (`denierName`, `colorName`, `colorCode`, …) are frozen at
  write time — history survives master edits. `stock_entries` carries ids
  with **no FK** (pure snapshot rows).
- `stock_entries` = append-only ledger: `stockType` raw|dyed, `movement`
  in|out, `source` + `sourceRefId` → the document that caused it.
- D1 has no interactive transactions: counter CAS commits first, then the
  whole write set goes out as ONE `db.batch()` (single atomic transaction).
- Unique indexes backstop duplicates:
  `(workspace, fy, number)` on challans/raw/packing,
  `(workspace, clientRef)` on challans, `(workspace, color, denier)` on recipes,
  `(recipeId, version)` on versions, `(packingItemId)` on sources.
- Deniers/colors masters start empty per workspace.

## 8 · API

Same-origin `/api/*` (Hono). Errors: `{ "error": "snake_case_code" }` —
frontends map codes → copy in ONE file (`packages/app-core/src/errors.ts`,
`friendlyError`). Stack traces never leave the server (detail only when
`APP_ENV=development`).

Middleware: query-stripped logger (tokens ride URLs) · secureHeaders ·
CORS allow-list — the native shells' fixed origin (`https://localhost`, the Capacitor WebView origin) is allowed in code; `CORS_ORIGIN` env adds third-party origins such as the website (comma-separated — credentials on) ·
client IP from `CF-Connecting-IP` (or rightmost XFF when `TRUST_PROXY=1`).

| Route                                            | Gate                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| `/health` · `/health/db`                         | —                                                                      |
| `/auth/*` lookup·otp·verify·password·session·qr  | —                                                                      |
| `/members`                                       | requireAuth + resolveMember                                            |
| `/company`                                       | manage_settings (row lazy-created)                                     |
| `/masters/*`                                     | manage_masters (Company tab: manage_settings) · 409 `in_use` on delete |
| `/recipes` (+ versions/restore)                  | manage_masters write · member read                                     |
| `/challans` (+ `/:id/pdf`)                       | create/edit/delete_challan · `?type&fy&q` · page 25, max 100           |
| `/returns`                                       | create_return/edit_return                                              |
| `/raw-material`                                  | create_raw_material/edit_raw_material                                  |
| `/packing`                                       | create_packing/edit_packing                                            |
| `/stock`                                         | view_stock                                                             |
| `/reports/*` (dashboard at `/reports/dashboard`) | view_reports                                                           |

Server modules are testable without HTTP; routes stay thin.

## 9 · Auth & security

**Identifier** — one input: phone (→ E.164) or email (→ lowercase),
auto-detected. `POST /auth/lookup` → `{ exists, hasPassword, hasInvite }`
drives routing. Zod at the boundary; dummy-hash on unknown user (no timing leak).

**Login paths**

- Existing user → OTP (Pingram SMS/email) or password if hash exists.
- New user → name (+ workspace name if no invite) → password optional,
  hidden for pre-added members → OTP → in.
- Pre-added member (invite) → straight into the inviting workspace; members
  are OTP-only. Invites resolve by identifier — no codes typed.
- No invite → creates own workspace as primary admin.

**QR login (primary desktop path)**

- Desktop shows QR → `/login/scan/<code>`; any camera with a session approves.
- Code `XXXX-XXXX-XXXX-XXXX` (~2⁷⁹), TTL 10 min, single-use CAS claim.
- `/qr/start` optional identifier → approves exactly that account.
- Status poll budget: 600/IP.
- OTP-quota fallback: quota exhausted → screen flips to "show QR" →
  owner scans → member in, zero OTP spent.

**OTP limits** (`src/server/auth/otp.ts`)

| Limit                          | Value                                                             |
| ------------------------------ | ----------------------------------------------------------------- |
| Code TTL                       | 5 min                                                             |
| Resend cooldown                | 30 s                                                              |
| Attempts per code              | 3 (atomic increment)                                              |
| Per identifier                 | 5 / hour · 12 / day                                               |
| Global daily spend kill-switch | `OTP_DAILY_BUDGET` (default 300/day) → 502 `otp_budget_exhausted` |
| Per IP                         | 10 requests + 30 verifies / 15 min                                |
| Storage                        | SHA-256 of code only — never plaintext                            |

**Password**

- PBKDF2-SHA256, 310 000 iterations, per-user salt, timing-safe compare.
  Format `pbkdf2$sha256$<iter>$<salt>$<hash>`. Min length 10.
- Client sends the password as-is — hashing is server-side only (owner mandate).
- Dummy-hash burn for unknown users (anti-enumeration).
- Lockout: 10 fails / 15 min per identifier+device; ×10 for the identifier
  across all devices (an attacker can't lock the owner out).

**Sessions**

- Token per device; DB stores SHA-256 `tokenHash` (unique). TTL 30 days.
- `devices` row per device (identity in the adapter's KV store);
  `lastSeenAt` throttled to 5 min (presence info, not per-request state);
  revoke per device from `/devices`.
- `login_attempts` powers the lockout counters.

## 10 · Permissions

Permission-based, no fixed roles (14 in `packages/shared/src/permissions.ts`):

```
create_challan edit_challan delete_challan
create_return edit_return
create_raw_material edit_raw_material
create_packing edit_packing
manage_masters view_stock view_reports
manage_members manage_settings
```

- `memberships.isPrimaryAdmin` bypasses all checks.
- `isPackerOnlyWorkspace()` → nav collapses to Packing only (packer mode).
- Nav hides what the user can't open (`useCanSee()`); every route is
  permission-gated server-side too.

## 11 · Offline & online-only saving

**Saving is online-only.** There is no write queue: a save goes straight to the
server, and when the server is unreachable the app says "go online" and keeps
the form the user was filling — input intact, nothing silently discarded. The
user retries once the connection returns.

What _does_ survive offline is the **read cache**, so a flaky connection never
blanks the pickers or an offline-restarted device. It lives in
`packages/app-core/src/offline/` and persists through the shell adapter's
synchronous KV storage — localStorage on web/Electron (`offline.*.v1`
keys), `@capacitor/preferences` on Android (behind a session map hydrated at
boot; see Section 5.1). Same cache, same behavior everywhere.

- Cached: masters (customers, job workers, suppliers, deniers, colors),
  company + numbering + per-FY counters, session profile, device identity.
- Reachability: `useNetworkState()` probes on mount and subscribes to the
  platform network event; `api()`'s classifier also flips the flag on a real
  failure. Only true network failures (incl. 502/504, captive portals) flip
  offline; HTTP errors stay online.
- Blocked save: the network error propagates as `network_error`, surfaced by
  `friendlyError` as "Could not reach the server". The editor keeps the form.
- Idempotency: `clientRef` (unique per workspace) + `originDevice` — no
  double-create when a response is lost after the server committed.
- Number clashes (409) are an online path: the server suggests the next free
  number and the list marks the row "Clash".
- Logout/session death wipes the caches (`clearAccountCache`) — one account's
  data can never surface under another's session.

No service worker: every navigation loads the shell over the network, and a
save attempted while unreachable surfaces the go-online message with the
form kept intact. The read cache above is the only thing that survives
offline.

## 12 · Realtime

Server push on top of the poll paths — an upgrade, never a dependency: if
the socket is down, lists stay correct through the 30 s heartbeat and
refetch-on-mount.

- Transport: one `RealtimeRoom` Durable Object per workspace
  (`src/server/realtime/room.ts`), WebSocket Hibernation API — idle sockets
  cost nothing on the free tier; client `ping` → `pong` is answered by the
  runtime's auto-response pair without waking the room. The room stores no
  business data (D1 stays the single source of truth).
- Auth: browser WS handshakes can't carry headers, so the client mints a
  one-shot ticket through the normal version-gated `POST /api/realtime/ticket`
  (session-scoped, single-use, 60 s TTL) and opens `GET /api/realtime/ws`
  (worker entry forwards upgrades; exempt from the version gate + Hono).
- Publish: every document write (challans create/update/delete, returns,
  raw-material, packing, masters CRUD) fans out tiny refresh hints
  `{"e":"<entity>","by":"<clientId>"}` via `publishChanges()` on
  `waitUntil` — best-effort, never blocks or fails the write.
- Client (`packages/app-core/src/realtime.ts`): `useRealtime()` mounts once
  per shell next to `useNetworkState()`; exponential-backoff reconnect,
  immediate on network return + app foreground (`onActivityChange`).
  Echo suppression via the stable install id in `X-Client-Id`
  (`clientId()` in api.ts) — a client skips events it caused itself.
- Consumption: pages call `useRealtimeEvent(entities, load)` to live-refresh
  (stock, packing, raw-material, returns, reports, dashboard, challan
  registers); events are hints — the actual data refetches through the
  normal `api()` paths, so the bus carries no business data.
- Android note: backgrounded sockets die; foregrounding (`AppState`) +
  network events drive reconnect. Pages refresh on focus as before.
- Challan PDFs: Electron renders locally with its own Chromium (works
  offline); web and Android fetch the server-rendered copy. Both paths
  render the SAME HTML template with inlined Inter → visually identical.

## 13 · PDFs

- One template: `src/shared/challan-html.ts` — an A5-landscape HTML document
  (masthead, party band, 12-row items table per sheet, totals, terms +
  signatures). Every surface renders exactly this markup.
- Two render paths: server → Cloudflare Browser Run `/pdf` (real Chromium;
  needs `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` secrets) for
  web/Android; Electron → `kc:render-pdf` IPC → `printToPDF` with the
  shell's own Chromium (fully offline). Same engine family + same inlined
  fonts → visually identical output.
- Fonts: Inter Regular/Bold TTFs bundled, inlined as base64 `@font-face`;
  server reads them from the `ASSETS` binding (Vite plugin copies to
  `dist/fonts`); no CDN, no system-font fallback.
- Errors: `pdf_not_configured` / `pdf_render_failed` / `rate_limited`
  (per-user budget: 120 renders/hour, counted only after the challan exists
  and the renderer is configured). No fallback renderer.
- Filenames sanitized. Print route (web): fonts awaited first
  (`document.fonts.ready`), then `window.print()`. Android downloads the
  server PDF and opens the system share sheet via the Android branch of
  `src/main/lib/platform.ts` (`sharePdfOnAndroid`).
- Restyles are staged as finished directions in `design-compare/` — ten
  challan-sheet (A–J), ten carton-sticker (S-A–S-J) and ten sales-report
  (R1–R10) directions, all pending owner picks. Counts and pick status live
  in its README (the single authority); the live templates don't change
  until a pick lands.

## 14 · App UI

`design.md` is the design system — the visual contract for every screen.
This section lists only the route map and the functional shape of each
area; radii, spacing, motion, shells and states live in `design.md`.

**Routes** (all `React.lazy`, one chunk per page; guard renders login inline)

/auth · /login/scan/:code · / (dashboard or packing) ·
/challans (+ editor/detail/:id/print) · /outward (same) · /returns ·
/raw-material · /stock/raw · /stock/dyed · /packing?type=sale|job_work ·
/colors · /reports/* · /masters · /members · /devices · /settings

Functional areas: dashboard (flow cards, period stats, dispatch charts,
recent challans); 7 reports (job-work-balance, over-receipts,
stock-summary, sales-register, job-work-register, transaction-log,
party-summary) with from/to picker and per-workspace column toggles;
stock grouped denier × color × lot with `q` filter; desktop sidebar ↔
mobile header + bottom tabs + drawer, with packing-only mode for packer
workspaces.

## 15 · Infra & deploy

Cloudflare free tier only. No VM, no Docker, no paid tiers. Anything beyond
this baseline needs an explicit owner question first.

| Piece     | Choice                                                                                                                                                                     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| apps/app  | Cloudflare **Workers** — one worker: static SPA + Hono API + `/releases/*` object serving (`run_worker_first` on both dynamic prefixes, so no static file can shadow them) |
| apps/web  | Cloudflare **Workers** via Vinext (separate project)                                                                                                                       |
| Database  | D1 `ks-biz-app-db` (app) · `ks-web-db` (website, isolated)                                                                                                                 |
| Releases  | R2 `ks-releases` bucket — installers, APK, update manifests under `app/`, served publicly at `/releases/*`                                                                 |
| Hostnames | `app.katariasyntex.workers.dev` (app) · `web.katariasyntex.workers.dev` (website) — custom domain parked (no purchase)                                                     |

**Secrets & vars** — `.env*` / `.dev.vars` are owner-only. Never read, echo,
copy, or commit them. Secrets enter only as env read at use site.

| Binding / var       | What                                                   |
| ------------------- | ------------------------------------------------------ |
| `DB`                | D1 binding                                             |
| `ASSETS`            | Worker static assets (fonts for PDF render)            |
| `RELEASES`          | R2 release bucket (`/releases/*` serving)              |
| `CORS_ORIGIN`       | extra third-party origins (native shells are built in) |
| `APP_ENV`           | `development` → error detail in responses              |
| `PINGRAM_API_KEY`   | OTP sender (secret)                                    |
| `OTP_DAILY_BUDGET`  | global daily OTP send ceiling (default 300)            |
| `TRUST_PROXY`       | `1` → trust rightmost XFF (behind a proxy)             |
| `VITE_API_URL`      | Electron build → deployed API origin                   |
| `VITE_PROXY_TARGET` | dev proxy target (default `localhost:3000`)            |

**Workflows**

- `pipeline.yml` — one workflow for everything, on every push/PR to main
  (and manual dispatch): `gate` (typecheck + lint + format + build) first;
  then `deploy` (app: build SPA → ensure D1 exists (auto-provision, inject
  real id into `wrangler.jsonc`) → apply migrations → ensure `ks-releases`
  bucket exists → `wrangler deploy`; website: same for its worker + inquiry
  DB), `desktop` (win-x64, mac-arm64, linux-x64) and `android` APK (from
  `apps/android`: build `apps/app` → `cap sync android` → `assembleRelease`;
  native project committed under `apps/android/android/`) in parallel; then
  `publish-r2` uploads artifacts + rewrites `latest.json`/`latest*.yml` via
  `scripts/publish-releases.ts` and prunes everything older (latest-only).
  Push builds publish only when `package.json` `version` differs from the
  published manifest — bumping the version IS the release action. Manual
  dispatch can scope `targets` to `desktop` or `android` and additionally
  creates the GitHub Release record (`release` job, dispatch-only).
  Requires `APP_URL` repo variable; `CLOUDFLARE_API_TOKEN` needs **Workers
  R2 Storage Edit**.

## 16 · Updates & versioning

Single source of truth: `apps/app/package.json` — `version` (this release)
and `minAppVersion` (breaking-change floor; `0.0.0` = gate off). The server
answers `426 update_required` to any client whose `X-App-Version` is below
`minAppVersion` (`src/server/lib/version-gate.ts`); `/api/auth` and health
stay reachable so the update UI can explain itself. The manifest
(`app/android/latest.json`) carries `version`, `minVersion`, `releasedAt`
and per-platform paths; the /download page, Android poller and macOS check
all read it.

| Shell          | Update mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web            | No service worker — index.html revalidates on every navigation, so the next load, reload, or reopen runs the fresh build with no prompt and no reload. The boot manifest check fills the Settings version line and arms the force-update floor.                                                                                                                                                                                                                                                                                                     |
| Electron Win   | `electron-updater` generic feed `/releases/app/desktop/win` — silent check at launch + every 4h, silent download, one-click NSIS installs invisibly on quit (`autoInstallOnAppQuit`). No OS notification, no setup UI, no in-app prompt; Settings carries the deliberate restart. Closing the window is the quit that applies it                                                                                                                                                                                                                    |
| Electron Mac   | Unsigned builds can't self-install — manifest poll; a dismissible title-bar banner (deferred until the next version) offers the dmg, opened via the OS browser (`openReleaseUrl`)                                                                                                                                                                                                                                                                                                                                                                   |
| Electron Linux | Same as Windows against `/releases/app/desktop/linux`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Android        | Manifest poll (launch + every 4h) downloads a newer APK on any network the moment it finds one — no Settings visit, no WiFi gate. The system installer still needs one tap (an OS limit, not an app one), so the download finishing fires one notification pointing at it; Settings keeps the action for anyone who dismissed it. A required server floor remains blocking — see BACKLOG C1. Boot compares the native versionName with the executing bundle (`reloadOnStaleAndroidBundle`) so a replaced APK can never leave a stale bundle running |

Per-shell behaviour contract lives in Section 5.1; the table below is the
delivery mechanism. APK install path detail is in Section 5.1; the
update-announcement notification, the APK stream and the bundle self-heal
are all described there.

Settings → About carries the manual "Check for updates" row; on web that row
is a readout plus the manual check, with no install action at all. Only the
blocking `update-dialog.tsx` (undismissable, host-appropriate action) acts on
a forced update. Breaking-change protocol lives in AGENTS.md Section 4.0.1: bump
`version` + `minAppVersion` together, never keep old API shapes alive.

**Free-tier limits** (Cloudflare — re-verify before claiming; limits change)

| Service           | Limit                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| Workers           | 100k requests/day · 10 ms CPU/invocation                                                                     |
| D1                | 500 MB storage · 5M row reads + 100k row writes/day · Time Travel 7 days                                     |
| R2                | 10 GB storage · Class B (read) 10M/month · Class A (write) 1M/month · egress free — one release set ≈ 400 MB |
| `db.batch()`      | one atomic transaction — no interactive BEGIN                                                                |
| Browser Rendering | Browser Run `/pdf`: 10 browser-min/day free, 1 req/10 s — per-user 120/h budget guards it                    |
| Pingram           | PAID per SMS/email — the only cost line, owner-approved; hard OTP ceilings above exist because of it         |

**Policy (owner-mandated)**: free forever ($0) · trusted durable providers ·
zero lock-in (plain SQLite export, static bundles, env config) · minimal
footprint · minimal maintenance.

## 17 · Caching policy (mandatory, every layer)

Three layers cache in apps/app. Each has one owner and one contract — never
let a cache outlive the data it mirrors, and never add a new cache without
stating its invalidation story here.

| Layer                 | Owner / file                                                      | Policy                                                                                                                                                                                                                                                                                                                  |
| --------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP — static assets  | `public/_headers` (deployed into `dist/` by Vite)                 | `index.html` + unhashed files (icons, `theme-init.js`, fonts): `max-age=0, must-revalidate`. Hashed `/assets/*`: `max-age=31536000, immutable`. Only content-hashed URLs may be `immutable`. Deploys are atomic (Workers publishes every file together), so HTML never references missing or mixed-revision assets.     |
| HTTP — API + releases | `src/server/index.ts` middleware · `lib/releases.ts`              | Every `/api/*` response: `Cache-Control: no-store` (set after `next()`). Release manifests `max-age=60`; versioned artifacts `immutable`.                                                                                                                                                                               |
| Client data           | app-core: zustand stores + `packages/app-core/src/data-caches.ts` | Module caches (stock/packing/raw/returns/reports/dashboard cards) are stale-while-revalidate keyed by workspaceId, registered via `registerDataCache`, wiped on logout/401/fresh login. Persisted offline state rides the shell adapter's KV storage: localStorage (web/Electron), `@capacitor/preferences` on Android. |

Rules that keep this from regressing:

1. **A cache needs an invalidation story or it doesn't ship.** Every new
   cache states what clears it (TTL, version key, event) in the same change.
2. **Unhashed content needs a short TTL.** Anything served
   under a stable URL (`theme-init.js`, manifests) is revalidated every
   time. Content-hashed files are the only things allowed `immutable`.
3. **No routine update surface anywhere.** Web and Android never prompt,
   banner or dialog for a deploy — the next navigation runs the fresh web
   build and the APK install is a Settings action. Desktop (Windows/Linux) stages silently and
   installs on quit; the macOS dmg banner is the only non-blocking announce.
   Only a server `426` floor may block (`update-dialog.tsx`). Never instruct
   users to clear caches or browsing data.
4. **API responses are never cached client-side or edge-side.** The offline
   read cache (`packages/app-core/src/offline`) hydrates pickers and company
   state but stores no list freshness — a failed refresh keeps the last rows
   rather than mixing in stale ones.
5. **A deploy must never require a manual reload.** The running tab keeps
   its code until its next navigation. Lazy chunks invalidated by a deploy are
   handled by one reload (`lib/lazy-route.ts`). Electron's `app://` handler
   sets its own cache headers — custom protocols are cached against the
   request URL otherwise.

## 18 · Dev & test

- Local D1 = `.wrangler/state/v3/d1/…sqlite` (plain SQLite — readable).
  `bun run db:migrate:local` applies migrations.
- Local workerd verifies: `/api/health`, `/api/health/db`, SPA serving,
  JSON 404s, migrations.
- **OTP testing budget**: limits in Section 9 — an identifier at the daily
  cap is locked out until the oldest row ages out (24 h). Plan test sends
  or reuse an existing session.
- Dev user: phone `+91 63515 70979` — no password, OTP-only.
- QR login needs a second logged-in device (any camera) to approve.
- Dev logs (`api*.log`) are throwaway and gitignored — never commit them.

## 19 · Pointers

- `design.md` — design system (mandatory read for UI work).
- ADRs are recorded in code comments: ADR-0001 (permission model, no fixed
  roles) and ADR-0003 (exclusive packing consumption).

**Open decision**: password hashing algorithm — scrypt vs PBKDF2.
Owner picks; then update code + this line.
