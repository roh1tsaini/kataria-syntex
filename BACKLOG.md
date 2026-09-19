# BACKLOG — focus list

Owner picks items from here; an agent takes one ID and executes it under the
rules in `AGENTS.md` (Section 2.3 parity, Section 2.4 verification, Section 4.1 decision
authority). Every item carries enough context to start cold. Delete an item
when it ships; history lives in git.

## 1. Owner decisions (blocked on a call)

- [x] **B5 · Repo-wide format:check normalization.**
      Configured `.prettierrc.json` with `"endOfLine": "auto"` and ignored generated native
      Android project assets in `.prettierignore`, making `bun run format:check` pass 100% clean.
- [x] **B6 · Version bump / release.**
      Bumped `apps/app/package.json` `version` to `0.21.0` cutting release for all audit fixes,
      SEO, robots.txt, format normalization, and architectural pipeline modularizations.
- [x] **B7 · Inline confirmation beside the triggering action.**
      Created `useInlineSaved` in `components/editor-shell.tsx` and attached checkmarked "Saved"
      states for 2 seconds to high-traffic form triggers (e.g. Save details, Save numbering) beside toasts.

## 1b. Findings from the 2026-09-14 full audit (all verified by reading code)

Every item below was confirmed against the actual code. Fix targets
`apps/app`; business-app changes land in BOTH shells (AGENTS.md Section 2.3).

### Critical

_None open._ Standing caveats that shipped with resolved items and are still
true today:

- **Android PDF output is a share, not a print.** No maintained Capacitor
  plugin prints a file; the only path to Android's `PrintManager` is
  hand-written Java. `shareChallanPdfOnAndroid` hands the server-rendered PDF
  to the system share sheet and the user picks Drive, a print app, or Save
  (`apps/app/APP.md` Section 5.1).
- **Masters with history archive instead of deleting.** A color/denier with
  stock or document rows is hidden from pickers, not removed; the probe
  matches by id **and by copied name**, so a name collision with another
  workspace's document archives a row that could have been deleted. That errs
  toward preserving history.
- **`resolveMember` assumes one membership per user.** The DB rejects a
  second membership; if prod already held a duplicate when the unique index
  was created, the CI deploy fails loudly at `wrangler d1 migrations apply`
  rather than silently picking a workspace.
- **Hono dispatches the first matching handler.** Master-specific route
  overrides must be registered in `registerMasterOverrides()` before the
  generic `registerMaster(...)` routes — a route appended after them is dead
  code.

### High

- [x] **A13 · Web SEO: canonical URLs, OpenGraph, Twitter cards, and JSON-LD.**
      `apps/web/src/app/layout.tsx:12-35` & `apps/web/src/app/(main)/products/[slug]/page.tsx:21-48` —
      added site-wide `alternates.canonical`, rich OpenGraph and Twitter cards, and injected
      Schema.org `Product` JSON-LD on product detail pages.
- [x] **A14 · Web mobile nav landscape scroll.**
      `apps/web/src/components/ui/dialog.tsx:39` & `apps/web/src/components/layout/SiteHeader.tsx:112` —
      added `overflow-y-auto` to `DialogContent` and adjusted mobile nav wrapper to `min-h-full`,
      preventing clipping in landscape viewports.

### Medium

- [x] **A19 · `GET /api/challans/:id/pdf` permission model & rate limiting.**
      `routes/challans.ts:319` — confirmed intentional: PDF generation is a read
      operation open to all workspace members (viewing/printing challans has no role gate),
      with Cloudflare Browser Rendering budget defended via per-user rate limiting.
- [x] **A20 · Company Tab: Enter in a numbering input saves numbering.**
      `components/company-tab.tsx:366-418` — document numbering controls wrapped
      in a dedicated `<form onSubmit={...}>` with `<Button type="submit">`,
      ensuring Enter key submits numbering.
- [x] **A23 · Production site.url fallback & pipeline variable injection.**
      `apps/web/wrangler.jsonc:7-10`, `pipeline.yml:223`, & `turbo.json:8` — declared
      `NEXT_PUBLIC_SITE_URL` in wrangler.jsonc vars and pipeline.yml build step with
      `https://web.katariasyntex.workers.dev` fallback and documented in `DEPLOY.md`.
- [x] **A24 · `/links` open/closed live periodic refresh.**
      `apps/web/src/components/links/BusinessCard.tsx:58-75,250` — added `liveStatus` client
      state with 30s interval and `visibilitychange` listener calling `openStatus()`, keeping
      the open/closed dot accurate.
- [x] **A25 · Returns editor real-time & focus balance revalidation.**
      `ui/pages/returns.tsx:516-545` — wired `useRealtimeEvent(["returns", "challans"])`
      and window focus listener to revalidate job worker challan balances in the
      background, preventing stale balance and over-receipt checks.
- [x] **A26 · Packing `netWt` computation and manual override alignment.**
      `ui/pages/packing.tsx:613-645` — confirmed intentional behavior and added
      inline documentation matching `raw-material.tsx:538`: net weight auto-fills
      when gross/tare or sacks change, and manually entered net weights remain
      intact until weight fields are changed again.
- [x] **A28 · Electron PDF partition CSP hardening.**
      `electron/main.ts:410` & `src/shared/challan-html.ts:441` — attached
      `onHeadersReceived` CSP header on `kc-pdf` session partition and injected
      `<meta http-equiv="Content-Security-Policy">` enforcing
      `default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:; script-src 'none'`.
- [x] **A38 · Masters GET routes are open to members (reads open, writes gated).**
      `routes/masters.ts:313-328` — master-list GETs are open to all authenticated
      workspace members so pickers across challans/returns/packing function.
      `recipes GET /` aligned to member read per `APP.md` §7 and detail routes;
      all mutations strictly gated by `manage_masters`.
- [x] **A41 · Silent / unhandled promises on boot and refresh paths.**
      `ui/App.tsx:149` (`void bootstrap()` documented as self-contained fire-and-forget),
      `ui/components/app-shell.tsx:704` (`refreshCompany()` hydrates from `readCompany()`
      on network errors, non-network errors surfaced via `toastError`; `authStore.bootstrap()`
      hydrates cached company on offline restart).

### Low

- [x] **A32 · Pending invites partial unique index & race guard.**
      `db/schema.ts:206-214` & `auth/members.ts:40-75` — added partial unique indexes
      `uq_invites_active_phone` and `uq_invites_active_email` on unconsumed invites,
      updated `addPendingMember` to update existing unconsumed rows in-place, and
      caught unique constraint conflicts in `routes/members.ts` to return `already_pending` (409).
- [x] **A34 · Over-receipt validation cap on job work returns.**
      `lib/document-pipeline.ts:580-598` — enforced sanity cap on job work yarn returns
      at max(200% of outward sent weight, sent + 50 kg), rejecting catastrophic typos
      with `over_receipt_exceeded` (400) and preventing stock inflation.
- [x] **A44 · Web robots.txt crawl prevention for private/API endpoints.**
      `apps/web/src/app/robots.ts:6` — added `disallow: ["/api/"]` to prevent crawlers
      from probing internal API endpoints.
- [x] **A45 · Web polish & accessibility.**
      Unified lifted-card style via `@utility card-lift` in `globals.css`; added `aria-live="polite"`
      announcements to `ProductIndex.tsx`; added `loading.tsx` and `error.tsx` for dynamic `/links`
      and `/contact` routes; updated `not-found.tsx` with direct escape routes to yarn index and shade card.

### Cross-cutting notes

- **The 426 version gate is armed.** `minAppVersion` is `0.19.1` in
  `apps/app/package.json` (bumped with the `already_registered` code
  rename), so `VERSION_GATE_ENABLED` is true and stale clients get
  `update_required` on every gated call.
- **OTP per-IP budgets are in-memory short-circuits over D1 ceilings.**
  Verified 2026-09-17: isolate rotation only regains the 10-requests /
  30-verifies per-15-min IP slice; per-identifier hourly/daily/global
  ceilings in D1 still hold. Accepted as layered design, not a hole.
- **Invariant enforcement is one-layered in three places** (membership
  uniqueness, colors `stockType`, master archive-or-delete):
  a rule assumed by the consumer but enforced only by one producer. That
  is the shape that breaks when a new caller skips the guarded path.
- **Verified clean, do not re-audit:** no SQL injection (all Drizzle, raw
  SQL parameterized); constant-time OTP/password compares with dummy-hash
  enumeration defense; every workspace-scoped read filtered by
  `workspaceId`; no spinners (skeletons only); `packages/app-core` has zero
  DOM access; Electron preload minimal with `contextIntegration`/`sandbox`
  and thorough IPC origin validation; web hydration safe (seeded PRNG,
  `getServerSnapshot`), reduced motion genuinely respected, fonts fully
  self-hosted.

## 3. Deferred from the parity pass

- [x] **D1 · Blur surfaces everywhere (header, sheet scrims, frosted glass).**
      Configured frosted glass blur with `-webkit-backdrop-filter` fallback across headers,
      dialog/settings overlay scrims, floating circle & capsule bars, and sticky action bars
      with `prefers-reduced-transparency` overrides; documented in `design.md` Section 2.6.
- [x] **D3 · Breathing room: `Field` label typography.**
      Updated `FieldLabel` default in `components/ui/field.tsx` to `text-[13px] font-medium leading-snug`
      and documented standard in `design.md` Section 2.4.

## 4. Code cleanup

Each item lists the files, the risk, and what "done" requires.

### Priority 1 — do when touching the area

- [x] **C1 · Shared editor-shell for packing / raw-material / returns.**
      Extracted `EditorSectionHeader`, `EditorErrorBanner`, and `useInlineSaved` into `components/editor-shell.tsx`,
      consumed across `packing.tsx`, `raw-material.tsx`, and `returns.tsx`.

### Priority 2 — structural, needs test cover first

- [x] **C2 · Split `document-pipeline.ts` (1,288 lines).**
      Modularized into `pipeline/{challans,returns,raw,packing,common}.ts` with stable export signatures,
      shared `assertMatchingFy`, unified party resolvers, and standardized `toIso()`.
- [x] **C3 · Split `challan-html.ts` (443 lines) + golden-file test.**
      Added golden snapshot test in `challan-html.test.ts` (green under `bun test`), then split into
      `challan-types.ts`, `challan-css.ts`, `challan-sheet.ts`, with `challan-html.ts` preserving
      byte-for-byte identical output.
- [x] **C5 · Dedupe the mirrored helpers.**
      Shared release content types and content-type detection in `@kataria-syntex/shared`
      (`releases.ts`), consumed by both `server/lib/releases.ts` and `scripts/publish-releases.ts`
      alongside shared semver helpers. Unified `electron/build.ts` and `electron/dev.ts` behind
      shared `electron/bundle.ts`.

### Explicitly deferred (recommendation: never, unless forced)

- **jsqr → `BarcodeDetector`** — 1 call site
  (`use-camera-scanner.ts`). Chromium-only; Firefox/Safari still need jsqr
  fallback. If revisited: `BarcodeDetector` with jsqr fallback + lazy
  `import()` of the scanner chunk.
- **QR named-identifier fallback removal** (`auth-qr.ts`, `qr-login.ts`) —
  the most intricate auth code for the rarest flow. Product sign-off
  required; full login-matrix re-verification on web + Electron + Capacitor.
- **Auth 4-router merge** — highest blast radius in the codebase.
  Incremental only (the `ALL_PERMISSIONS` filter dup is the safe first
  step).
- **`woven.ts` / `thread.ts` freeze** — decorative shade textures, correct
  but disproportionate. Freeze as `shade-texture` with visual regression
  tests; pre-render to static CSS/PNG only if perf bites.
- **Dialog-as-mobile-menu (`SiteHeader`)** — works, tested a11y. Replace
  with a popover + CSS transition only if bundle weight forces it.
- **Single-use primitives/hooks** (`input-otp`, `toggle-group`, `calendar`,
  `avatar`, `useCameraScanner`, `useCountdown`, `cn.ts` seam) — correct
  steady state for vendored code. Leave alone.
- **Big-file splits** (`colors.tsx`, `dashboard.tsx`, `app-shell.tsx`) —
  subcomponents only if they keep growing, never moves for their own sake.
