# KNOWN BUGS — apps/app fix backlog

> Written 2026-08-24 after a full dead-code/dead-file audit.
> Context: the repo was cleaned first (all unused code removed, dependencies
> purged, typecheck/lint/format/build all green). These are the **functional
> bugs** found during that audit. Work through them top-down when remaking /
> rebuilding the app. Tick `- [ ]` → `- [x]` when fixed and verified.

---

## 1. Android — native build is missing 4 Capacitor plugins (runtime crashes)

- [x] Fixed & verified (2026-08-29 — `bun run build` → `bunx cap sync android`;
      all four plugins **plus** `@capacitor/preferences` now appear in all
      three sync files: `android/app/capacitor.build.gradle`,
      `android/capacitor.settings.gradle`,
      `android/app/src/main/assets/capacitor.plugins.json`.)

**Symptom:** print, share/save-PDF, secure token storage, and offline file
features crash or silently fail on Android.

**Cause:** the committed Capacitor sync output only knows about
`@capacitor/preferences`:

- `apps/app/android/app/capacitor.build.gradle`
- `apps/app/android/capacitor.settings.gradle`
- `apps/app/android/app/src/main/assets/capacitor.plugins.json`

Missing plugins that the JS code dynamically imports at runtime:

- `@capacitor/filesystem` (`src/main/lib/offline-pdf.ts`)
- `@capacitor/share` (`src/main/lib/offline-pdf.ts`)
- `@capgo/capacitor-printer` (`src/main/lib/platform.ts`)
- `capacitor-secure-storage-plugin` (`src/main/lib/platform.ts`)

**Fix:** production build (`npm run build`) → `npx cap sync android` → verify
the four plugins appear in the gradle/plugins files → rebuild APK in CI.

## 2. Electron — packaged desktop app shows a white screen

- [x] Fixed & rebuilt (2026-08-25 — Electron restored as an official target
      with a new architecture: renderer stays in `dist/`, main+preload compile
      to `dist-electron/` via `electron/build.ts` (Bun), and the window loads
      `../dist/index.html`. The old electron-vite outDir mismatch is gone by
      construction — there is no second renderer build anymore.)

## 3. PWA — service worker and manifest never ship

- [x] Fixed & verified (2026-08-25 — `VitePWA` wired into `vite.config.ts`
      with a full manifest, real icons generated from `resources/icon.svg`
      via `bun run icons`, SW registered through `virtual:pwa-register` in
      `main.tsx`. Verified in the production build output.)

**Symptom:** web/PWA install has no offline shell, no manifest, not
installable.

**Cause (three layers):**

1. `vite.config.ts` registers NO PWA plugin, so web/Android builds (`bun run
build`, `pwa:build`, `android:sync`) get nothing.
2. No file imports `virtual:pwa-register` → even where the plugin runs, the
   service worker never registers (`registerType: "autoUpdate"` needs the
   virtual-module import).
3. No manifest icons exist anywhere, so it can never be installable.

**Fix:** move `VitePWA` into `vite.config.ts`, add real icons (192/512 +
maskable), create `public/favicon.svg`, register the SW via
`virtual:pwa-register` in `main.tsx`.

## 4. Docker — API image cannot build from a clean checkout

- [-] Obsolete (2026-08-30 — Docker/VM stack being removed entirely by the
  Cloudflare migration; see `apps/app/CLOUDFLARE.md`). Was: _(Dockerfile rewritten 2026-08-24 — `.dockerignore`
  added at repo root 2026-08-29, every COPY path verified to exist,
  `bun:sqlite` needs no native build deps, `drizzle/` migrations are
  committed. **Still blocked:** no Docker daemon in the local env — the
  final `docker build -f apps/app/Dockerfile .` from repo root must run on
  the owner's machine.)_

**Cause:**

- `Dockerfile:7` — `COPY package.json bun.lockb ./` but no Bun lockfile exists
  anywhere under `apps/app` (install currently happens through the npm
  workspace at repo root).
- `Dockerfile:20` — copies `/app/dist` from the builder stage, but no stage
  builds the renderer; it only works when a local `dist/` sneaks in via
  `COPY . .`.

**Fix (applied):** rewritten for **repo-root build context** — copies root
`package.json` + `bun.lock` + workspace manifests for cached install, runs
`bun install --frozen-lockfile`, then builds server (`dist-server`) and
renderer (`dist`) in-image. Remaining: run the build once against a real
Docker daemon and confirm `/api/health` responds from the container.

## 5. CI — desktop builds ship without app icons

- [x] Fixed & verified (2026-08-25 — icons live in `apps/app/resources/`
      (outside any ignored directory), generated from `icon.svg` and
      referenced by `electron-builder.yml`; no gitignore negations needed)

## 6. Security/slop — "Skip QR (dev)" button ships to production

- [x] Fixed & verified _(2026-08-24 — entire dev bypass removed, not just
      gated)_

Removed completely from the app:

- `qr-login-panel.tsx` — skip button, `onSkip` prop, `handleSkip`, dev-mode
  badge (`pairing.devMode`), `Zap` import.
- `auth.tsx` — "Skip login (dev mode)" button and `skipLogin` usage.
- `store/auth.ts` — `skipLogin()` action (fake permissioned session).
- `lib/api.ts` + `lib/dev-mock.ts` — `VITE_DEV_SKIP_LOGIN` mock backend;
  `dev-mock.ts` deleted.
- Server — vestigial `devMode`/`devCode` fields stripped from
  `auth/otp.ts`, `auth/qr-login.ts`, `routes/auth.ts`.
- `.env.local` — `VITE_DEV_SKIP_LOGIN=true` removed.
- `members.tsx` — "Dev mode code" invite toast removed.

Verified: typecheck 3/3 · lint 2/2 · production builds green.

---

## Minor traps (fix opportunistically)

- [x] `lib/dev-mock.ts` returned canned rows for POST/PUT — file deleted
      2026-08-24 along with the whole dev-bypass path (see #6).
- [x] `apps/web/eslint.config.mjs:43` sets
      `react-refresh/only-export-components` but the plugin isn't installed
      nor registered — inert dead config (leftover from eslint-config-next).
      Remove the rule or add the plugin. _(Verified 2026-08-29 — the rewritten
      46-line `apps/web/eslint.config.mjs` no longer references
      `react-refresh` anywhere; `react-refresh` isn't installed in
      `apps/web/package.json` either.)_
- [x] `skills-lock.json:4–9` still lists the completed `migrate-radix-to-base`
      skill — cosmetic staleness. _(Verified 2026-08-29 —
      `apps/app/skills-lock.json` contains only the `shadcn` skill; no
      `migrate-radix-to-base` entry.)_
- [x] `capacitor.config.json` `webDir: "dist"` has no static fallback if a
      script forgets to build first (ordering-safe today, fragile tomorrow).
      _(2026-08-29 — ordering is enforced by construction: every
      `android:*` script in `apps/app/package.json` runs `bun run build`
      before any `cap` command, and the CI Dockerfile builds the SPA in-stage
      before serving.)_
- [ ] `apps/web/src/app/api/inquiry/route.ts:43` — **PENDING 2026-08-27 per owner** — not working on web app rn, will decide storage later (`.data/inquiry.jsonl` / SQLite / email). Currently validates and returns `{ok:true}` but **drops data** — not done. See `route.ts:43` comment.

---

### 2026-08-27 — Record audit state + this session's edits

> Context summary supplied by the user describes work done PRIOR to this agent
> session (C1–C5 + all HIGHs). Recording repo state accurately; **only edits
> actually performed in this session are marked below**.

#### CRITICALS — already fixed (prior)

- [x] C1 OTP rate-limit bypass (`server/auth/otp.ts`).
- [x] C2 Ownership-transfer partial commit (`server/auth/members.ts` — `TransferCasError`).
- [x] C3 Duplicate challans on lost response (idempotency `clientRef`).
- [x] C4 Stock misclassification of undyed yarn (`server/lib/stock.ts`).
- [x] C5 Cross-account offline-cache leak (`clearAccountCache()`).

#### HIGHs — already fixed (prior)

- [x] All items listed in the context summary (delete 409, returns qty,
      auth OTP/session, invite conflict, offline list, api.ts, platform.ts,
      challans/delete, dashboard, app-shell, nav gating).

#### This session — actually edited

- [x] `server/routes/members.ts` — fixed missing `and` import (was blocking typecheck).
- [x] `pages/{packing,raw-material,returns,stock}.tsx` — added `aria-label` to
      the four Input-Group search inputs (no accessible name before).
- [x] `app-shell.tsx` — Ctrl+B now ignored when an `input`/`textarea`/
      `contentEditable` is focused (was hijacking in-field shortcuts).

#### NOT done this session (still TODO — for a follow-up)

- [x] Challan editor unsaved-changes guard (`beforeunload` + confirm on Cancel).
      _(2026-08-29 — `dirty` state, `beforeunload`, and `onCancel()` with the
      existing `useConfirm` wired across all three Cancel buttons in
      `pages/challans.tsx`; cleared after prefill and after save.)_
- [x] `confirm-dialog.tsx` — heading focus, body scroll lock, Esc-to-cancel.
      _(2026-08-29 — heading ref + `onOpenAutoFocus` focus the title instead of
      Cancel; Radix Dialog already provides scroll-lock and Esc-to-cancel.)_
- [x] `components/ui/button.tsx` — `asChild`, `aria-label`, `h-11` defaults.
      _(Verified 2026-08-29 — already present in the working tree: `asChild`
      via Radix `Slot`, `aria-label` passthrough, `h-11` base + `sm:h-10`.)_
- [x] `use-countdown.ts` — `{mm,ss}` tuple + `aria-live`.
      _(2026-08-29 — returns `{mm, ss}`; `qr-login-panel` renders
      `mm:ss` padded and announces expiry via `aria-label` + `role="status"`
      on the countdown.)_
- [x] `pages/reports.tsx` — confirm `loadError` surfaces after cache refresh.
      _(Verified 2026-08-29 — `reportCache` + `loadError` + inline Retry are in
      the working tree; cache refresh no longer re-renders stale "empty".)_
- [x] `pages/challans.tsx` detail 404 fallback path ("Apply removed" etc.).
      _(2026-08-29 — `ApiError.code === "not_found"` renders an `Empty` state
      with a back link; other errors keep the existing error branch.)_
- [x] `qr-login-panel` / `code-entry-form` pin-input keyboard-nav.
      _(2026-08-29 — `code-entry-form` is now a real `<form>` so Enter submits
      (camera button is `type="button"`); `qr-login-panel` countdown is
      exposed to screen readers.)_
- [x] `sync-dialog.tsx` conflict-resolution UX.
      _(2026-08-29 — conflict input+button wrapped in a form (Enter applies),
      success toast, and the sheet re-reads the queue so resolved rows drop out
      immediately.)_
- [x] `reports.tsx` column-toggle persistence.
      _(2026-08-29 — Popover + Checkbox, `localStorage` key
      `reports.hiddenCols`, per-column toggling with last-column guard, stale
      keys pruned, `visibleColumns` drives the table.)_
- [x] `members.tsx` touch-target sizing audit.
      _(Verified 2026-08-29 — working tree already carries `min-h-11 …`
      `sm:min-h-9` sizing and the typo fixes.)_
- [ ] Re-run audit agents (server + offline + UI) — pending a clean typecheck.
      _(Typecheck/lint/build are green again as of 2026-08-29 — re-running the
      audit agents themselves is still open.)_
- [x] `bun run build` end-to-end verification.
      _(2026-08-29 — root `bun run build` green (web Next.js + app Vite/PWA,
      precache 68), plus `apps/app` `build:server` bundle compiles; deletion of
      the Vite `configLoader: 'native'` `__dirname` warning is optional.)_

#### Verification gate

- [x] `bun run typecheck` green
- [x] `bun run lint` green
- [x] `bun run build` green from repo root
- [~] `bun run format:check` green except 5 pre-existing
  `docs/.obsidian/*.json` files (Obsidian config drift, not touched this
  session — out of scope; safe to `bunx prettier --write docs/.obsidian/*.json`
  if you want the gate fully green).

---

- Dead code deleted: shared `PERMISSION_BUNDLES`, `getShade()`,
  numbering type aliases, server `redeemInvite()` + `hasPermission()`,
  duplicate schema bundle block, 8 unused route imports, frontend dead
  imports/motion constants/`permissionCountBadge`.
- Dead file archived: `packages/shared/src/company.ts` →
  `dead-files/packages/shared/src/company.ts`.
- Dependencies purged: `dotenv`, `tsx`, `@radix-ui/react-{separator,switch,toggle}`
  (app); `zod`, `clsx`, `tailwind-merge` (web); root `@types/mssql` override.
- Verified after cleanup: typecheck 3/3 · lint 2/2 · Prettier clean · both
  production builds green.

Historical docs/specs live in `dead-files/` (moved there deliberately).

---

### 2026-08-31 — Full-app audit + fix pass (server, offline, electron, UI)

Three parallel audits (server / frontend lib+stores / UI) followed by fixes.
Repo hygiene in the same pass: `testplay.mjs`, `testplay2.mjs`, `e-smoke.out`,
`e-smoke.err` → `dead-files/scratch/`; `.wrangler/` added to ESLint ignores.

#### Server — fixed

- [x] **P0 IDOR**: `packing.ts` transfer updated entries by id only — now
      workspace-scoped + 404, and the target must actually hold
      `create_packing` (membership alone no longer passes).
- [x] Request logger query redaction was a no-op (QR codes/tokens reached
      logs) — query string now stripped.
- [x] 500 error detail was fail-open (anything ≠ "production" leaked
      messages) — now only `APP_ENV === "development"`.
- [x] Pre-add consume could burn two invites and still fail signup when two
      workspaces invited the same identifier — consume is now CAS on the
      exact invite row.
- [x] `removeMember` / `setMemberPermissions` ran multi-step writes as
      separate awaits (partial states on failure) — now one `db.batch()` each.
- [x] Returns PUT recomputed balances per item **including the return being
      edited** → false overReceipt on near-full challans; now excludes the
      edited return and computes once per challan (shared
      `getChallanBalance`, duplicate in returns.ts deleted).
- [x] Offline number clash race (TOCTOU) surfaced as generic 500 — lost race
      now returns the existing `challan_number_conflict` / 409 shape.
- [x] `sql.raw(String(n))` in FY counter catch-up → bound parameter.
- [x] PDF `Content-Disposition` filename sanitized (device-issued numbers
      could inject CR/LF/quotes).
- [x] `devices.lastSeenAt` wrote on every authenticated request → throttled
      to once per 5 min per device.
- [x] QR approve update now CAS on `status='pending'` (concurrent approves
      can't overwrite `grantedTo`); route maps the lost race to
      `qr_already_approved` (409).
- [x] `/qr/start` unbounded global DELETE → bounded purge (≤500 rows).
- [x] Stock `/movements` `Number("junk")` → NaN limit → 500; now parseInt +
      fallback. Stock color lookup workspace-scoped.
- [x] Masters routes: `registerMaster` de-`any`'d (generic over zod input),
      deletes of masters still referenced return 409 `in_use` instead of FK
      500, ids via `generateId()`.
- [x] Members PUT/DELETE: workspace scope moved from JS into the SQL.
- [x] Pingram failure detection parses JSON instead of substring-matching
      `"error"`.
- [x] Non-null `!` removed (`session.expiresAt`, `ipWindows.get(ip)`,
      signup `workspaceName`); dead `BROWSER_RUN_*` env vars deleted;
      unused `parseIdentifier` wrapper deleted.

#### Offline/lib/electron — fixed

- [x] **P0** `crypto.randomUUID()` outside try crashed challan creation in
      insecure contexts — shared CSPRNG `randomId()` used everywhere.
- [x] Sync false-success race: `resubmitWithNumber`/`retryErrored` could
      report ok while the item never left the queue — `syncUntilSettled`
      re-checks until the item settles.
- [x] `runSync` delivered from a stale snapshot (deleted challans
      reappeared server-side; mid-flight creates waited 30s) — per-item
      re-validation + up to 3 passes.
- [x] `probeServer` used raw fetch → Electron saw the server as permanently
      offline; now goes through the `api()` seam (delivery timeouts via
      `timeoutMs` + AbortController on both transports too).
- [x] `api()` Electron and web branches disagreed on success/error
      classification — one shared classifier; token read deferred on the
      desktop branch; ~14 redundant keychain round-trips deleted from
      `store/auth.ts`.
- [x] Electron IPC `kc:api` validates the renderer payload (path prefix,
      method allowlist, header types, clamped timeout); `kc:download` added
      so desktop PDF downloads go through the bridge (file:// renderer can't
      reach the API directly).
- [x] Electron `build.ts` fails without `APP_URL` instead of baking the
      `CHANGE_ME` placeholder; `dev.ts` TDZ crash on early Vite exit fixed.
- [x] All localStorage reads shape-guarded (`unknown` + guards; corrupt JSON
      drops instead of poisoning); storage alias re-exports deleted
      (create/sync import from `@kataria-syntex/shared`); cached session
      workspace permissions validated instead of cast.
- [x] Challan store `load()` race (pending branch skipped the loadSeq
      guard); masters store 5× copy-paste CRUD → one factory; dead
      `useToasts` shim deleted; `blobToBase64` resolves on `load` only.

#### UI — fixed (2026-08-31 UI batch)

- [x] Settings forms no longer clobbered by concurrent company refreshes
      (dirty-guard hydration).
- [x] Remaining UI audit items (popover asChild, print-route auth guard,
      nested interactive elements, logout hang, confirm-dialog queue,
      dashboard cross-account caches, touch targets, motion/a11y fixes,
      dead code) — applied by the UI fix batch; gate results below.

#### Deferred / owner decisions (NOT fixed — need the owner)

- [ ] Document-pipeline god-module split + update-path dedup, DTO types into
      `packages/shared` — scheduled with the upcoming DB/logic rewrite.
- [ ] Router-level unsaved-form blocking on packing/returns/raw-material
      (needs `createBrowserRouter` migration) — `beforeunload` guard added
      in the meantime.
- [ ] Tabs component redesign (underline indicator per design.md §3 vs
      current segmented pill) — design.md says owner approves extensions.
- [ ] Bottom-nav vs sidebar item mismatch (`/outward` promoted on mobile
      only); sidebar `margin-left` animation; `RegisterList` extraction;
      packing sale/job-work form dedup.
- [ ] SPEC.md/CLOUDFLARE.md say `scrypt`, code uses PBKDF2 — owner to pick
      which is truth (AGENTS.md §4.1).
- [ ] `GET /company` lazily creates the company row; `GET /challans`
      unbounded; `/reports/transaction-log` duplicates `/stock/movements` —
      revisit with the DB rewrite.
- [ ] `raw-material.ts` `stock_consumed` guard can never fire today (no code
      creates out-movements referencing raw entries) — kept as the future
      invariant; confirm intent with owner.

#### Verification gate (this pass)

- [x] `bun run typecheck` green (server + renderer + electron configs)
- [x] `bun run lint` green
- [x] `bun run format:check` green
- [x] `bun run build` green from repo root
- [x] Runtime smoke: dev server + login → dashboard renders new shell
      (2026-08-31; sidebar rebuilt same session, owner re-testing)
