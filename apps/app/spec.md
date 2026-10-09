# apps/app — spec

What this file owns: the business app, in two parts.

- Part 1 — Business: screens, fields and data. The owner's plan.
- Part 2 — Tech: database, API, auth, platforms, updates, infra, caching. Verified against code, current state only.
- Logic, calculations, numbering and edge cases: `rules.md`.
- UI values: `design.md`.
- Ops, CI, secrets, backups: `DEPLOY.md`.
- Section numbers (1 to 14) belong to Part 2. Links like "`spec.md` Section 5.1" mean Part 2.
- Items under **Open** and **Conflicts** are not decided. Nothing in them is built.

## Part 1 — Business

**Overview**

- Internal app for yarn job work: soft, dye, final coning, pack, deliver
- Tracks stock only: where it is, what stage, who owns it
- No prices, billing, payments or accounting (schema stays open to add later)
- One app on Android, Windows, Linux, macOS and web (shells: Section 5)
- English only
- No data import from the old software
- Simple fields, short forms, smart defaults, last picks remembered
- Load: 4 to 10 users on a normal day, 20 to 50 challans on a busy day

**Auth**

- Mechanics, limits and tables: Section 8
- Methods: email OTP, phone OTP, optional password, QR login, Telegram
- OTP sender: Pingram, free tier only
- Pingram free tier: 100 SMS or 3,000 emails per month (pricing page, checked 6 Oct 2026)
- Telegram: a bot on the admin's account sends the login code or approval to the admin
- Admin can pass a Telegram code to any user
- SMS monthly cap is set in settings
- More channels and their priority: Open

**Roles and permissions**

- Admin: everything. Invites users, makes all entries, edits saved entries, makes challans
- Packer: packing screen only, can only add
- Admin can give "make challans" to other users
- Only admin edits anything saved
- Every edit logs who, when and the old value
- No other roles
- Data: `users` gets `role` and `status`; new `permissions(user_id, key, on)`, `audit_log(id, user_id, action, entity, old, new, at)`

**Companies**

- Admin adds own companies and switches from the top of the app
- Per company: name, address, gstin, pan, mobile, terms text, challan series, stock, lot numbers
- Shared across companies: parties, color book, tare items, denier/quality list
- Data: `companies(id, name, address, gstin, pan, mobile, terms)`

**Parties (one list)**

- One list for suppliers, customers and job workers, each with tags
- Fields: name, tags, address, gstin, mobile
- Many delivery locations per party, one default
- Job worker extra: dye batch capacity (cones), pending alert days, kg basis (includes tubes: yes, no, not sure)
- Built-in job worker "in-house" for own dyeing, with its own capacity
- Data: `parties(id, name, tags, address, gstin, mobile)`, `locations(id, party_id, name, address, is_default)`, `job_workers(party_id, capacity_cones, alert_days, kg_basis)`

**Stock model**

- Unit of stock is a batch
- Batch: lot no, owner, holder, stage, denier/quality, color, cones, kg, parent links
- Owner: one of my companies or a customer
- Holder: my factory, a job worker, or in transit
- Operations: receive, send, return, process, split, merge, reject, adjust, change owner
- Every operation links parent to child
- "History" button on any batch shows where it came from
- Data: `batches(id, lot_no, company_id, owner_id, holder_id, stage, denier, color_id, cones, kg)`, `movements(id, type, from_batch, to_batch, kg, cones, by, at)`, `links(parent_id, child_id, share)`

**Denier/quality list (settings)**

- Managed list, shared across companies
- Forms pick from it

**Raw material in**

- Fields: date (today), supplier, owner, net kg
- Optional: gross, supplier lot, denier, supplier challan no
- Owner dropdown groups: my companies, customers
- Owner type (own stock or customer yarn) fills itself from the pick
- Totals only, no box rows
- Optional photo scan fills the form (see Scan challan)

**Soft and sacks**

- Raw and soft are one stock, tracked in kg only
- Soft yarn is packed in sacks and held with sack count and kg
- Softening is not a separate stage
- Sacking keeps the lot number

**Send to job worker**

- Fields: job worker, lot, denier, color, cones, gross, less (auto), nett, bags
- Color default: "white grey (undyed)"
- Totals only, one row
- Cones split into dye batches by worker capacity
- Warns if cones are not a multiple of capacity, suggests topping up
- Color per batch: one color for all (default) or a different color per batch
- Challan prints as one summary row or one row per dye batch
- Making the send-out challan moves stock to the job worker

**Receive from job worker**

- Pick job worker, app lists their open send-outs, pick one
- Rows prefill per dye batch: color, cones, bags
- User types only kg per row from their challan (optional)
- "Received in full" button skips everything else
- Partial returns allowed
- Color different from plan is flagged
- Optional: their challan no
- Each dyed batch gets a new lot no and its color

**In-house dyeing**

- Same flow as a job worker, using the "in-house" worker
- Pick recipe from the color book, dye amounts scale to kg
- No challan needed

**Final coning**

- Pick dyed lot, final cones prefilled with the dyed count, one tap to accept
- Count can be changed
- Optional rejected count with reason (color, damage, other)
- Rejected cones go to reject stock, flow in `rules.md` (Reject loop)
- Re-soft is an entry: weight in kg, marked "re-dye"

**Packing (packer screen)**

- Header: date (auto), lot, color, denier (from batch), tube type, box type (last used remembered)
- Rows: box no (auto), gross, box tare, cones
- Less and nett are auto
- Entries wait as "packed, waiting for challan"
- A box with two lots uses the same box no on two lines
- Data: `boxes(id, box_no, company_id, batch_id, lot_no, gross, tare, cones, nett, packed_by, packed_at, challan_id, status)`

**Tare items (settings)**

- List: type (tube, box, bag), name, weight per piece in grams
- Helper: weigh N pieces, enter the total, average fills in
- Dropdowns on forms, last pick remembered per stage and denier
- Manual less override allowed
- Tubes and cartons are not tracked as stock
- Data: `tare_items(id, type, name, grams, active)`

**Challans**

- Types: job worker send-out, delivery, return, custom
- Each type has: heading text, series code (JW1, DC1), direction, item type (yarn or other), columns, stock effect, copies
- Firm name is the same on every type, the heading carries the type
- Fields: date, number, my company, party, deliver at, vehicle no, driver, remarks, e-way bill no (optional), hsn (optional)
- Delivery rows: packed boxes, or kg from a lot at any stage
- Send-out rows: totals
- Totals are automatic
- Copies: original, duplicate, triplicate
- Print on A5, share as PDF
- Making a challan moves the stock by itself, no second entry
- Local deliveries go with the delivery challan, out of state goes with the party report attached to the e-way bill
- Data: `challan_types(id, heading, series, direction, columns, stock_effect)`, `challans(id, company_id, type_id, number, date, party_id, location_id, vehicle, driver, remarks, eway_no, status)`, `challan_rows(id, challan_id, box_id, lot_no, denier, color_id, cones, gross, less, nett, bags)`

**Orders and kanban**

- Order: party, color, kg, denier/quality, due date, notes
- On create the app checks stock and says what is missing
- Matching stock is reserved
- Status fills from linked batches, progress bar in kg
- Partial delivery, change and cancel allowed
- Kanban columns: raw/soft stock, sacks, at job worker, dyed, final coning, packed, delivered
- Cards are batches tagged with their order, filter by order
- Reject loop shows as an arrow from final coning back to soft
- Moving a card (or "move to next" on phone) opens a prefilled confirm
- Columns can be renamed or hidden
- Data: `orders(id, party_id, color_id, kg, denier, due, notes, status)`, `order_batches(order_id, batch_id, kg)`

**Color book (with recipes)**

- One section
- Color: name, code (like maroon-8016), party, sample photo (optional), notes, dark flag
- Built-in "white grey (undyed)"
- New color from an order or challan: type the name only, fill the rest later
- Same color name from different parties stays separate
- Recipes live inside each color, a color can have several
- Recipe: dye/chemical name and qty per kg, time, temperature, optional steps
- Recipe versions: old one kept and marked
- Recipe can be tagged with yarn type (polyester, viscose)
- Amounts scale to the batch kg
- A dyeing entry records which recipe was used
- Data: `colors(id, name, code, party_id, photo, notes, is_dark)`, `recipes(id, color_id, version, yarn_type, time, temp, steps)`, `recipe_items(recipe_id, name, qty_per_kg)`

**Reports (every report exports Excel and PDF)**

- Yarn pending at job workers: sent minus received, per worker and lot, days waiting
- Weight gain/loss per job worker and in-house: % over time, normal range, odd batches flagged
- Party report: party and date range, PDF like the old sales challan report, optional cones column, sorted by date
- Stock by stage and owner
- Order status
- Excel and PDF are made on the device

**Alerts**

- Triggers: `rules.md`
- Shown as a badge in the app and sent to the admin's Telegram bot
- A daily check runs them

**Monthly stock check**

- App lists expected stock by lot
- Tick "matches", type a count only where it differs
- Last counted date shown per lot

**Scan challan (optional)**

- Upload one photo, or two for a multi-page challan
- Step 1: on-device OCR (PaddleOCR in the browser) plus label matching fills header and totals
- Step 2: if totals are not found, Workers AI free tier
- Step 3: if that is used up for the day, type totals by hand
- Raw material keeps totals only, rows are used for the check

**Printing**

- Challan on A5, PDF for everything

**Settings**

- Companies, users and invites, tare items, denier/quality list, challan types and series
- Alert limits, monthly SMS cap, Telegram bot link
- Party list and color book have their own sections

**Open**

- Raw material in: record box count and box weight so raw can be sold in the supplier's boxes
- Challan rows without a box: which fields they hold
- Daily backup file sent to the admin's Telegram
- Keep the scanned photo with the entry
- Admin logs out any user's device
- Which company a packer packs for
- Other OTP channels and their priority
- Pingram SMS to India numbers: free-tier coverage to check
- Workers AI free allowance: verify before scan is built
- HSN code on job work challans (ask your CA)
- Meaning of "remarks" on the party report (ship-to?)
- Sticker labels: content, fields, sheet size, who prints
- Other challan types: heading, series, direction, columns, stock effect
- Prices and billing
- Dashboard draft, not approved:
  - Today: boxes packed, challans made, kg delivered
  - Yarn at job workers with days waiting, red when over the limit
  - Orders due soon and overdue
  - Stock by stage (kg and cones), filter by owner
  - Reject stock count
  - Alerts list
  - Quick buttons: raw in, send, receive, pack, new challan
  - Packer sees only the packing screen and his entries today

**Conflicts (plan vs current app, owner decides)**

- Sign-up
  - Plan: admin invites users from settings
  - App: anyone can sign up with name, OTP and optional password (Section 8)
- OTP cap
  - Plan: monthly SMS cap set by admin in settings
  - App: global cap of 300 sends per day set by env var `OTP_DAILY_BUDGET` (Section 8, Section 11)
  - Pingram free tier: 100 SMS or 3,000 emails per month

## Part 2 — Tech

Facts here are verified against code — update this part in the same change as the code. Current state only.

Contents: 1 What it is · 2 Tech stack · 3 Source map · 4 Commands · 5 Platforms (5.1 per-shell, 5.2 Android project, 5.3 update mechanisms) · 6 Database · 7 API · 8 Auth & security · 9 Offline & reachability · 10 App UI · 11 Infra facts · 12 Updates & versioning · 13 Caching · 14 Dev & test.

### 1 · What it is

**Overview**

- Internal business app shell for Kataria Syntex.
- One SPA bundle, three shells — web, Electron desktop, Android WebView
  (contract in Section 5).
- Backend — Hono on Cloudflare Workers + D1 (SQLite).
- Shared core — `packages/app-core` (API client, auth store, network
  reachability, data cache registry).
- Signed-in users land on an empty home screen inside `AppShell` (`/`), with
  navigation to Connected Devices (`/devices`) and Settings (`/settings`).

### 2 · Tech stack

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

### 3 · Source map

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

### 4 · Commands

All commands: `AGENTS.md` Section 3. This app's build notes:

- `electron:package` — local packaging command. CI builds one shared renderer
  and reuses it for Electron, Android and Worker deployment (`DEPLOY.md`
  Section 3).
- `build:electron` bundles main/preload and bakes `APP_URL` into
  `KC_API_ORIGIN`; it fails without `APP_URL`. `electron/dev.ts` deliberately
  skips the bake and points at `localhost:3000`.
- `release/` (400MB+ binaries) is excluded from `turbo.json` outputs —
  CI artifacts, never cached.
- Done = typecheck + lint + format + build green from repo root AND the
  feature works when run (`AGENTS.md` Section 2.4).
- Web, Electron and Android compile as one renderer bundle; `apps/android`
  typechecks and syncs (`bunx cap sync android`) against `packages/app-core`.

### 5 · Platforms

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

#### 5.1 · Per-platform behaviour

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

#### 5.2 · Android native project

**Gradle & manifest**

- `apps/android/android/` is a committed Capacitor Gradle project — native
  config only (manifest permissions, signing, ABI filters), never UI.
- `cap sync` copies the built bundle and the plugin list into it.
- **Phone testing runs through CI, never a local build.**
  `apps/android/scripts/build-web.ts` forces `https://` on the baked API
  origin and fails without one, so a bundle aimed at a local `wrangler dev`
  would speak TLS to a plain-HTTP server. Push, let the `android` job build
  the signed APK against the deployed worker (`vars.APP_URL`), install the
  artifact.
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
- Commands: `AGENTS.md` Section 3.

#### 5.3 · Update mechanisms

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

### 6 · Database

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

### 7 · API

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

### 8 · Auth & security

| Method    | Web | Desktop | Android |
| --------- | --- | ------- | ------- |
| Email OTP | ✓   | ✓       | ✓       |
| Phone OTP | ✓   | ✓       | ✓       |
| Password  | ✓   | ✓       | ✓       |
| QR login  | ✓   | ✓       | ✓       |

| Topic               | Rule                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Session             | opaque token in HttpOnly cookie (web) / `Authorization: Bearer` (native); 30-day TTL · storage per shell in Section 5 |
| QR login            | 10-min TTL codes in `qr_logins`; single-use CAS claim                                                                 |
| OTP delivery        | Pingram API — `https://api.pingram.co` (worker secret `PINGRAM_API_KEY`)                                              |
| OTP expiry          | 5 min; 3 verify attempts per code (CAS update)                                                                        |
| OTP resend cooldown | 30 s per identifier (429 `otp_resend_cooldown`)                                                                       |
| OTP daily caps      | 5/hr and 12/day per identifier · 10 per IP per 15 min · 300 global/day (`OTP_DAILY_BUDGET`)                           |
| Password            | optional PBKDF2-SHA256 (100k iterations, min 10 chars); dummy-hash on missing user                                    |
| Native persistence  | the desktop token never lands in a plain file · the Android KV is scoped to the app (storage per shell in Section 5)  |
| Desktop logout      | wipes native keychain + `localStorage` + `sessionStorage`                                                             |
| Devices management  | `/devices` and Settings → Devices list active sessions with current marker and per-device revoke                      |

**Flow**

- `/auth` → enter phone/email (`POST /api/auth/lookup`) or scan QR code
  (`POST /api/auth/qr/start`).
- Existing user → OTP sent (`POST /api/auth/otp/request`), verify code
  (`POST /api/auth/otp/verify`) or switch to password (`POST
/api/auth/password/login`).
- New user → collect name + optional password (`CreateStep`), send OTP,
  verify OTP → `POST /api/auth/signup`.
- Dev user — phone `+91 63515 70979`, OTP-only, no password.

### 9 · Offline & reachability

| Piece        | Behaviour                                                                                                               |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Session boot | `useAuth.bootstrap()` falls back to the cached user snapshot when `/auth/me` fails with a net error                     |
| Reachability | `Network.getStatus()` (native) / `navigator.onLine` + `online`/`offline` events (web) — one adapter                     |
| 401 handling | any 401 wipes client caches (`invalidateDataCaches`) and cached session snapshot (`clearSessionCache`), resets to guest |
| Banner       | `OfflineBanner` shows a persistent warning strip while `useSync.online` is `false`                                      |

### 10 · App UI

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

### 11 · Infra facts

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

| Service | Limit                                                                                                 |
| ------- | ----------------------------------------------------------------------------------------------------- |
| Workers | 100k requests/day · 10 ms CPU/invocation                                                              |
| D1      | 500 MB · 5M reads + 100k writes/day · Time Travel 7 days                                              |
| R2      | 10 GB · Class B 10M/mo · Class A 1M/mo · egress free (~400 MB/release set)                            |
| Pingram | Free tier only: 100 SMS or 3,000 emails/month (pingram.io/pricing, checked 6 Oct 2026) — no paid plan |

### 12 · Updates & versioning

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
- Release info `app/android/latest.json` carries `version`, `releasedAt`,
  per-platform paths, and the APK's `sha256`/`size`. Electron's Windows/Linux
  feed files are generated from this release info and the built installers.
- Only the live server's `426 update_required` response makes an update
  mandatory; the release-info file never carries an update floor.

### 13 · Caching

| Layer                 | Owner / file                                         | Policy                                                                                                                                      |
| --------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP — static         | `public/_headers` (deployed into `dist/` by Vite)    | `index.html` + unhashed files: `max-age=0, must-revalidate`. Hashed `/assets/*`: `max-age=31536000, immutable`.                             |
| HTTP — API + releases | `src/server/index.ts` middleware · `lib/releases.ts` | Every `/api/*` response: `Cache-Control: no-store`. Release manifests `max-age=60`; versioned artifacts `immutable`.                        |
| Client data           | `packages/app-core/src/data-caches.ts`               | Registered client caches (`invalidateDataCaches`) + cached auth user snapshot (`clearSessionCache`) are wiped on logout/401/account switch. |

### 14 · Dev & test

- Local D1 — `.wrangler/state/v3/d1/…sqlite` (plain SQLite, readable);
  `bun run db:migrate:local` applies migrations.
- Local workerd verifies — `/api/health`, `/api/health/db`, SPA serving,
  JSON 404s, migrations.
- OTP testing budget — limits in Section 8; an identifier at the daily cap
  is locked out until the oldest row ages out (24 h).
- Dev user — phone `+91 63515 70979`, no password, OTP-only.
- QR login needs a second logged-in device (any camera) to approve.
- Dev logs (`api*.log`) are throwaway and gitignored — never commit them.
