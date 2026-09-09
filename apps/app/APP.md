# APP.md — apps/app reference (maintained)

Single maintained doc for the business app. Kept current with the code —
**code is truth**; update this doc in the same change that updates code.

**Maintaining rules**

- Change code → change this doc in the same commit. No stale lines.
- New table/route/permission/limit → add a row. Removed thing → delete the row.
- Numbers here are verified against constants in code. When they disagree,
  fix the doc or the code — never let both drift.
- Current state only: describe what IS. No past talk, no change history.

---

## 1 · What this is

Internal app for Kataria Syntex (yarn dyeing + trading):
sales challans, job-work challans + returns, raw material purchase,
packing, stock ledger, reports, color recipes.

One SPA bundle for web/PWA and Electron desktop. The Android app is a
separate React Native workspace (`apps/android` — see its APP.md). All
shells share the business core (`packages/app-core`): API client, stores,
offline engine. Backend = Hono on Cloudflare Workers + D1 (SQLite).

```
purchase → job-work OUT (dyeing) → return → packing → sales challan
grey rolls    grey cones             dyed      packed    invoice
```

- Every document writes the `stock_entries` ledger.
- No money anywhere — movement papers only.
- Rolls cut to cones in-house: not tracked.

## 2 · Monorepo

Bun workspaces + Turborepo. Bun is the only package manager (`bun@1.3.14`).

| Path                | Role                                               |
| ------------------- | -------------------------------------------------- |
| `apps/app`          | Business app — web/PWA + Electron (this doc)       |
| `apps/android`      | Android app — React Native + Expo (its own APP.md) |
| `apps/web`          | Public website — Next.js + Vinext on Workers       |
| `packages/app-core` | Shared business core — API client, stores, offline |
| `packages/shared`   | Domain types, permissions, errors, numbering, FY   |
| `packages/tsconfig` | Shared TS presets                                  |

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
bun run icons          # regenerate PWA/app icons (sharp)
bun run electron:package
```

Packaging notes (local-only helpers — CI inlines the same steps in
`pipeline.yml`, so keep both spellings in sync when the flow changes):

- `electron:package` = `build` + `build:electron` + `electron-builder`.
  `build:electron` is also run solo mid-pipeline to inject `APP_URL`.
- `release/` (400MB+ unpacked binaries) is intentionally excluded from
  `turbo.json` build outputs — shipped as CI artifacts, never cached.

**Done** = typecheck + lint + format + build green from repo root
AND the feature works when run. Web/PWA and Electron compile as one
renderer bundle; `apps/android` typechecks and Metro-bundles against the
same `packages/app-core`.

## 3 · Tech stack

Latest stable majors; never downgrade to escape a break.

| Layer       | Tech                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| Frontend    | React 19 · react-router-dom 7 · zustand 5 · Vite 8 (SWC) · TS 7 (strict)                                                 |
| Styling     | Tailwind v4 · Radix primitives (shadcn pattern) · motion 12 · sonner 2                                                   |
| PWA         | vite-plugin-pwa (prompt mode, Workbox) — update banner in update-surface.tsx                                             |
| API         | Hono 4 · zod 4 at every boundary                                                                                         |
| Data        | Drizzle ORM + drizzle-kit · Cloudflare D1                                                                                |
| PDF         | shared HTML template → Chromium: Browser Run (server) + printToPDF (desktop)                                             |
| Desktop     | Electron 43 · electron-builder 26                                                                                        |
| Shared core | `@kataria-syntex/app-core` — API client, zustand stores, offline engine (web + Electron here, Android in `apps/android`) |
| Android     | separate workspace `apps/android` — React Native 0.86 · Expo SDK 57 · expo-router · NativeWind 4.2                       |
| QR          | qr-code-styling (show: rounded dots, extra-rounded eyes) · jsqr (scan) · input-otp                                       |
| CI          | GitHub Actions (`pipeline.yml`: gate → deploy + desktop + android → R2)                                                  |

## 4 · Source map

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
│   │   └── lib/                 # document-pipeline, stock, password, pingram…
│   ├── main/                    # SPA (web + electron share it)
│   │   ├── lib/platform.ts      # host detection + configureWebCore (app-core seam)
│   │   ├── lib/challan-pdf.ts   # challan PDF fonts + save/print
│   │   ├── store/updates.ts     # update banner / blocking dialog state
│   │   └── ui/                  # App.tsx routes, pages/, components/, globals.css
│   └── shared/                  # challan-html template + Inter TTFs
├── electron/                    # main.ts (keychain, net bridge, printToPDF), preload, build
├── drizzle/                     # migrations (timestamped folders)
├── design.md                    # design system — read before any UI change
└── wrangler.jsonc               # Worker + assets + D1 config

packages/app-core/               # shared business core (all shells)
├── src/adapter.ts               # PlatformAdapter seam — configureCore()
├── src/api.ts                   # api(), ApiError, apiBlob, deviceHeaders
├── src/store/                   # zustand: auth, challans, masters, recipes
├── src/offline/                 # caches + outbox + sync engine
├── src/errors.ts                # friendlyError
├── src/toast.ts                 # configureToasts sink
└── src/data-caches.ts           # registerDataCache / invalidateDataCaches
```

Request path:
SPA → same-origin `/api/*` (Vite proxy in dev) → Worker → Hono
→ `requireAuth` → `resolveMember` → `requirePermission` → lib module → D1.

## 5 · Platforms

Platform differences live in each shell's `PlatformAdapter`
(`packages/app-core/src/adapter.ts` — the seam where the business core
meets its host: API base, token storage, sync KV, network events, optional
Electron transport). This app configures it via `configureWebCore()` in
`src/main/lib/platform.ts` (wired in `main.tsx`); Android configures it via
`configureAndroidCore()` in `apps/android/src/lib/core-adapter.ts`. Never
branch on platform elsewhere.

| Shell    | Session storage                              | API origin                                                            |
| -------- | -------------------------------------------- | --------------------------------------------------------------------- |
| Web/PWA  | HttpOnly cookie                              | same-origin `/api/*` (Vite proxy in dev)                              |
| Electron | OS keychain via safeStorage (`kc:*` IPC)     | `APP_URL` injected by `build:electron` at build time                  |
| Android  | expo-secure-store (hardware-backed keystore) | `EXTRA_API_BASE` baked by CI; dev `localhost:3000` over `adb reverse` |

Build targets (fixed by owner):

- Android — universal APK (`assembleRelease`, built by CI from `apps/android`)
- Windows — NSIS x64
- macOS — dmg arm64 (Apple Silicon only)
- Linux — AppImage x64
- **iOS skipped — never build or scaffold for it.**

Electron renders challan PDFs locally via `kc:render-pdf` (printToPDF);
Android fetches the server-rendered PDF and shares/prints natively —
see §12 and `apps/android/APP.md`.

Desktop shell notes: one instance per installation (second launch focuses
the first), no menu bar in packaged Windows/Linux builds, pinch/ctrl-wheel
zoom locked, camera granted to app origins for QR scan/approve, packaged
renderer served at `app://bundle/` with SPA deep-link fallback, and the
document never scrolls — routed content scrolls in
`.app-scroll` under the custom title bar so the window controls sit flush
against the window edge (see design.md §2.7.1).

**Logged-out entry flow (web only)**: unauthenticated visitors to `/` get
the two-path entry screen (`ui/pages/entry.tsx` — Sign in / Install for
<detected OS>); `/download` lists all four platform installers from the
published manifest with brand glyphs (`ui/components/brand-icons.tsx`) and
"This device" recommendation (detection is cosmetic, never load-bearing);
the login screen links to `/download`. Signed-in users never see the entry
screen. Native shells are unaffected.

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

| Group               | Tables                                                                                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tenancy & auth (10) | `workspaces` · `memberships` · `member_permissions` · `users` · `devices` · `sessions` · `otp_codes` · `login_attempts` · `qr_logins` · `invites`                                                            |
| Masters (10)        | `companies` · `financial_years` · `customers` · `job_workers` · `suppliers` · `deniers` · `colors` · `color_recipes` · `color_recipe_ingredients` · `color_recipe_versions`                                  |
| Documents (10)      | `challans` · `challan_items` · `job_work_returns` · `job_work_return_items` · `raw_material_entries` · `raw_material_items` · `packing_entries` · `packing_items` · `challan_item_sources` · `stock_entries` |

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
CORS allow-list (`CORS_ORIGIN` env, comma-separated — credentials on) ·
client IP from `CF-Connecting-IP` (or rightmost XFF when `TRUST_PROXY=1`).

| Route                                           | Gate                                                         |
| ----------------------------------------------- | ------------------------------------------------------------ |
| `/health` · `/health/db`                        | —                                                            |
| `/auth/*` lookup·otp·verify·password·session·qr | —                                                            |
| `/members`                                      | requireAuth + resolveMember                                  |
| `/company`                                      | manage_settings (row lazy-created)                           |
| `/masters/*`                                    | manage_masters · 409 `in_use` on delete                      |
| `/recipes` (+ versions/restore)                 | manage_masters write · member read                           |
| `/challans` (+ `/:id/pdf`)                      | create/edit/delete_challan · `?type&fy&q` · page 25, max 100 |
| `/returns`                                      | create_return/edit_return                                    |
| `/raw-material`                                 | create_raw_material/edit_raw_material                        |
| `/packing`                                      | create_packing/edit_packing                                  |
| `/stock` · `/stock/movements`                   | view_stock                                                   |
| `/reports/*` · `/dashboard`                     | view_reports                                                 |

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
- Open decision: hashing algorithm — scrypt vs PBKDF2. Owner picks;
  then update code + this line.

**Sessions**

- Token per device; DB stores SHA-256 `tokenHash` (unique). TTL 30 days.
- `devices` row per physical machine (web fingerprint in localStorage);
  `lastSeenAt` throttled to 5 min; revoke per device from `/devices`.
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

## 11 · Offline & sync

Offline targets: challans (sales + outward) only. The engine lives in
`packages/app-core/src/offline/` and persists through the shell adapter's
synchronous KV storage — localStorage on web/Electron (`offline.*.v1`
keys), MMKV on Android. Same engine, same behavior everywhere.

- Cached: masters (customers, job workers, suppliers, deniers, colors),
  company + numbering + per-FY counters, session profile, device identity.
- Outbox (`offline.pending.v1`): pending | conflict | error, each holding the
  exact create body + local projection.
- Offline numbering uses the cached counter; `bumpCounter` prevents repeats.
- Idempotency: `clientRef` (unique per workspace) + `originDevice` — no
  double-create when a response is lost.
- Sync triggers: app boot, `online` event, 30 s interval, manual retry.
  Single-flight, 3-pass loop, re-reads each item before delivering.
- 409 on number clash → conflict state + server's suggested next number →
  user adopts/edits → resync. Rejected items show the error code.
- Logout/session death wipes the outbox + caches (`clearAccountCache`) —
  one account's queue can never sync under another's session.
- Network classifier: only true network failures (incl. 502/504, captive
  portals) flip offline; HTTP errors stay online.
- Challan PDFs: Electron renders locally with its own Chromium (works
  offline); web/PWA and Android fetch the server-rendered copy. Both paths
  render the SAME HTML template with inlined Inter → visually identical.

## 12 · PDFs

- One template: `src/shared/challan-html.ts` — an A5-landscape HTML document
  (masthead, party band, 12-row items table per sheet, totals, terms +
  signatures). Every surface renders exactly this markup.
- Two render paths: server → Cloudflare Browser Run `/pdf` (real Chromium;
  needs `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` secrets) for
  web/PWA/Android; Electron → `kc:render-pdf` IPC → `printToPDF` with the
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
  server PDF and prints it through the Android print framework or the share
  sheet (`apps/android/src/lib/pdf.ts`).
- Restyles pending in `design-compare/`: ten challan-sheet directions (A–J),
  ten carton-sticker directions (S-A–S-J), and ten sales-report formats
  (R1–R10, each in both A4 orientations). Its README has status + the pick
  workflow; live templates unchanged.

## 13 · App UI

`design.md` is the design system — read before any UI change. Tokens live in
`ui/globals.css`; never fork per-page styles. NO spinners anywhere —
skeleton shimmer only. Motion from `ui/lib/motion.ts`; exits mirror entries;
`prefers-reduced-motion` respected. 44px touch targets; dark mode considered.

**Shell**

- Desktop: fixed sidebar `w-60` ↔ collapsed rail `w-14` (Ctrl+B, persisted).
- Mobile: translucent header + bottom tab bar + drawer; sync badge on tabs.
- Sections: Operations · Stock · Reports · Color Organiser · Masters ·
  Administration (+ `PACKER_SECTIONS` = packing-only mode).

**Routes** (all `React.lazy`, one chunk per page; guard renders login inline)

`/auth` · `/login/scan/:code` · `/` (dashboard or packing) ·
`/challans` (+ editor/detail/`/:id/print`) · `/outward` (same) · `/returns` ·
`/raw-material` · `/stock/raw` · `/stock/dyed` · `/packing?type=sale|job_work` ·
`/colors` · `/reports/*` · `/masters` · `/members` · `/devices` · `/settings`

**Dashboard**: FlowCards (Sent · Returned · In Stock Raw · In Stock Dyed ·
Sold) · period fy | 30d | all with Δ% vs previous · stats (challans issued,
packages, net kg, job-work sendings) · dispatch bars + customer donut
(top 5 + Other) · recent 6 challans + quick links.

**Reports (7)**: job-work-balance · over-receipts · stock-summary ·
sales-register · job-work-register · transaction-log · party-summary.
From/to picker; column toggles persisted (`reports.hiddenCols`);
skeleton/empty/error states everywhere.

**Stock pages**: raw | dyed, grouped denier × color × lot, `q` filter,
lot chips, color dots, negative-balance alert.

## 14 · Infra & deploy

Cloudflare free tier only. No VM, no Docker, no paid tiers. Anything beyond
this baseline needs an explicit owner question first.

| Piece     | Choice                                                                                                                 |
| --------- | ---------------------------------------------------------------------------------------------------------------------- |
| apps/app  | Cloudflare **Workers** — one worker: static SPA + Hono API + `/releases/*` object serving                              |
| apps/web  | Cloudflare **Workers** via Vinext (separate project)                                                                   |
| Database  | D1 `ks-biz-app-db` (app) · `ks-web-db` (website, isolated)                                                             |
| Releases  | R2 `ks-releases` bucket — installers, APK, update manifests under `app/`, served publicly at `/releases/*`             |
| Hostnames | `app.katariasyntex.workers.dev` (app) · `web.katariasyntex.workers.dev` (website) — custom domain parked (no purchase) |

**Secrets & vars** — `.env*` / `.dev.vars` are owner-only. Never read, echo,
copy, or commit them. Secrets enter only as env read at use site.

| Binding / var       | What                                         |
| ------------------- | -------------------------------------------- |
| `DB`                | D1 binding                                   |
| `ASSETS`            | Worker static assets (fonts for PDF render)  |
| `RELEASES`          | R2 release bucket (`/releases/*` serving)    |
| `CORS_ORIGIN`       | comma-separated extra origins (website)      |
| `APP_ENV`           | `development` → error detail in responses    |
| `PINGRAM_API_KEY`   | OTP sender (secret)                          |
| `OTP_DAILY_BUDGET`  | global daily OTP send ceiling (default 300)  |
| `TRUST_PROXY`       | `1` → trust rightmost XFF (behind a proxy)   |
| `VITE_API_URL`      | Electron build → deployed API origin         |
| `EXTRA_API_BASE`    | Android APK build → deployed API origin (CI) |
| `VITE_PROXY_TARGET` | dev proxy target (default `localhost:3000`)  |

**Workflows**

- `pipeline.yml` — one workflow for everything, on every push/PR to main
  (and manual dispatch): `gate` (typecheck + lint + format + build) first;
  then `deploy` (app: build SPA → ensure D1 exists (auto-provision, inject
  real id into `wrangler.jsonc`) → apply migrations → ensure `ks-releases`
  bucket exists → `wrangler deploy`; website: same for its worker + inquiry
  DB), `desktop` (win-x64, mac-arm64, linux-x64) and `android` APK (from
  `apps/android`: `expo prebuild -p android` → `assembleRelease`; native
  project generated on the runner, not committed) in parallel; then
  `publish-r2` uploads artifacts + rewrites `latest.json`/`latest*.yml` via
  `scripts/publish-releases.ts` and prunes everything older (latest-only).
  Push builds publish only when `package.json` `version` differs from the
  published manifest — bumping the version IS the release action. Manual
  dispatch can scope `targets` to `desktop` or `android` and additionally
  creates the GitHub Release record (`release` job, dispatch-only).
  Requires `APP_URL` repo variable; `CLOUDFLARE_API_TOKEN` needs **Workers
  R2 Storage Edit**.

## 14.1 · Updates & versioning

Single source of truth: `apps/app/package.json` — `version` (this release)
and `minAppVersion` (breaking-change floor; `0.0.0` = gate off). The server
answers `426 update_required` to any client whose `X-App-Version` is below
`minAppVersion` (`src/server/lib/version-gate.ts`); `/api/auth` and health
stay reachable so the update UI can explain itself. The manifest
(`app/android/latest.json`) carries `version`, `minVersion`, `releasedAt`
and per-platform paths; the /download page, Android poller and macOS check
all read it.

| Shell          | Update mechanism                                                                                                                                                                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web/PWA        | Service worker (`vite-plugin-pwa` prompt mode) — new deploy precaches in the background, the update banner applies it on click; never an auto-reload. Hourly hidden SW check covers long-lived tabs                                                              |
| Electron Win   | `electron-updater` generic feed `/releases/app/desktop/win` — check at launch + every 4h, silent download, install on quit ("Restart now" action)                                                                                                                |
| Electron Mac   | Unsigned builds can't self-install — manifest poll + "Download new dmg" dialog (`openReleaseUrl` → OS browser)                                                                                                                                                   |
| Electron Linux | Same as Windows against `/releases/app/desktop/linux`                                                                                                                                                                                                            |
| Android        | Manifest poll (`apps/android/src/lib/updates.ts` — launch + every 4h) → banner → APK streamed via expo-file-system into app-private storage (progress) → system package installer (REQUEST_INSTALL_PACKAGES); first install asks once for "install unknown apps" |

Settings → About carries the manual "Check for updates" row. Force updates
render the blocking `update-dialog.tsx` (undismissable, host-appropriate
action). Breaking-change protocol lives in AGENTS.md §4.0.1: bump
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

## 14.2 · Caching policy (mandatory, every layer)

Four layers cache in apps/app. Each has one owner and one contract — never
let a cache outlive the data it mirrors, and never add a new cache without
stating its invalidation story here.

| Layer                    | Owner / file                                         | Policy                                                                                                                                                                                                                                                                                             |
| ------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP — static assets     | `public/_headers` (deployed into `dist/` by Vite)    | `index.html`, `sw.js`, icons, `theme-init.js`: `max-age=0, must-revalidate`. Hashed `/assets/*`: `max-age=31536000, immutable`.                                                                                                                                                                    |
| HTTP — API + releases    | `src/server/index.ts` middleware · `lib/releases.ts` | Every `/api/*` response: `Cache-Control: no-store` (set after `next()`). Release manifests `max-age=60`; versioned artifacts `immutable`.                                                                                                                                                          |
| Service worker (web/PWA) | `vite.config.ts` `VitePWA` workbox block             | Precache all JS/CSS chunks (offline is a feature — see §11). TTF/PNG runtime cache `app-runtime-v1`, CacheFirst, 16 entries / 30 days, versioned name so deploys start fresh.                                                                                                                      |
| Client data              | app-core: zustand stores + `src/data-caches.ts`      | Module caches (stock/packing/raw/returns/reports/dashboard cards) are stale-while-revalidate keyed by workspaceId, registered via `registerDataCache`, wiped on logout/401/fresh login. Persisted offline state rides the shell adapter's KV storage: localStorage (web/Electron), MMKV (Android). |

Rules that keep this from regressing:

1. **A cache needs an invalidation story or it doesn't ship.** Every new
   cache states what clears it (TTL, version key, event) in the same change.
2. **Unhashed content needs a short TTL or a revision.** Anything served
   under a stable URL (`theme-init.js`, manifests) is either revalidated
   every time or carries a revision in the SW manifest. Content-hashed files
   are the only things allowed `immutable`.
3. **The service worker never force-reloads a tab.** Updates apply through
   `store/updates.ts` (banner, or the 426 blocking dialog). `registerType`
   stays `"prompt"`; do not reintroduce `autoUpdate`.
4. **API responses are never cached client-side or edge-side.** Offline
   queuing (`packages/app-core/src/offline`) is the only freshness-storing
   mechanism, and it replaces stale summary rows rather than mixing them.
5. **Update installs wait for the SW.** The web reload happens only after
   the waiting worker controls the page (`store/updates.ts`) — a blind
   reload re-serves the old precached shell and can loop on a 426.

## 15 · Dev & test

- Local D1 = `.wrangler/state/v3/d1/…sqlite` (plain SQLite — readable).
  `bun run db:migrate:local` applies migrations.
- Local workerd verifies: `/api/health`, `/api/health/db`, SPA serving,
  JSON 404s, migrations.
- **OTP testing budget**: 5 sends/identifier/hour, 12/day — an identifier at
  the daily cap is locked out until the oldest row ages out (24 h). Plan test
  sends or reuse an existing session. Global cap 300/day applies too.
- Dev user: phone `+91 63515 70979` — no password, OTP-only.
- QR login needs a second logged-in device (any camera) to approve.
- Dev logs (`api*.log`) are throwaway and gitignored — never commit them.

## 16 · Pointers

- `design.md` — design system (mandatory read for UI work).
- ADRs are recorded in code comments: ADR-0001 (permission model, no fixed
  roles) and ADR-0003 (exclusive packing consumption).

**Open decision**: password hashing algorithm — scrypt vs PBKDF2.
Owner picks; then update code + this line.
