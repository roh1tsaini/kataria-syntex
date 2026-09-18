# BACKLOG — focus list

Owner picks items from here; an agent takes one ID and executes it under the
rules in `AGENTS.md` (Section 2.3 parity, Section 2.4 verification, Section 4.1 decision
authority). Every item carries enough context to start cold. Delete an item
when it ships; history lives in git.

## 1. Owner decisions (blocked on a call)

- [ ] **B5 · Repo-wide `format:check` fails on Windows CRLF.**
      Pre-existing; every non-Android file is flagged on this machine. Fix
      via `git add --renormalize .` in a dedicated commit or
      `endOfLine: "auto"` — owner picks.
- [ ] **B6 · Version bump / release.**
      `AGENTS.md` Section 4.0.1: bump `apps/app/package.json` `version` when a
      change warrants a release; the bump is the release action. Owner call
      for the parity pass and future sessions.
- [ ] **B7 · Inline confirmation beside the triggering action.**
      Material 3's snackbar rule: an auto-dismissing message must also be
      communicated inline or near the action that raised it (a Save button
      relabelling to "Saved"). Most of the ~50 `toastSuccess`/`toastError`
      call sites in `apps/app` raise the banner alone, so the confirmation
      lives only in a surface that disappears. Decide: add inline
      confirmation at the highest-traffic triggers (saves, deletes, sync),
      or accept the banner as the only signal.

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

- [ ] **A13 · Web SEO: no `og:image`, Twitter card, or canonical URL.**
      `apps/web/src/app/layout.tsx:12` — one `openGraph` reference
      site-wide (`siteName` + `type` only); no `twitter` block, no
      `alternates.canonical`, so `metadataBase` is dead config. Sharing any
      page renders a text-only card. No JSON-LD on product detail pages
      either — the highest-value SEO spot on the site.
- [ ] **A14 · Web mobile nav clips in landscape.**
      `apps/web/src/components/ui/dialog.tsx:39` —
      `DialogContent` is `fixed inset-0` with no `overflow-y-auto`, and the
      inner column (`SiteHeader.tsx:112`) does not scroll either; ~504px
      of content in a 390px-tall viewport clips the last links and "Send
      inquiry". Portrait is fine, which is why it ships.

### Medium

- [ ] **A19 · `POST /api/challans/:id/pdf` has no permission gate.**
      `routes/challans.ts:314` — `requireAuth` + `resolveMember()` only; a
      member with zero permissions can render PDFs (consuming the
      per-user-limited Browser Run budget). Every sibling write route is
      gated, so the omission looks accidental.
- [x] **A20 · Company Tab: Enter in a numbering input saves numbering.**
      `components/company-tab.tsx:366-418` — document numbering controls wrapped
      in a dedicated `<form onSubmit={...}>` with `<Button type="submit">`,
      ensuring Enter key submits numbering.
- [ ] **A23 · `site.url` falls back to a `workers.dev` subdomain.**
      `apps/web/src/content/site.ts:9` — `NEXT_PUBLIC_SITE_URL` is set in
      neither `wrangler.jsonc` nor the CI workflow, so the fallback is the
      baked production value, feeding `metadataBase`, `sitemap.xml`,
      `robots.txt` and the `/links` Website row.
- [ ] **A24 · `/links` open/closed status never refreshes.**
      `apps/web/src/app/links/page.tsx:12` — server-computed once with no
      client re-check; a page opened at 6:55 PM shows "Open now · till 7:00
      PM" past closing, wrong for the exact visitor who needs it.
- [x] **A25 · Returns editor real-time & focus balance revalidation.**
      `ui/pages/returns.tsx:516-545` — wired `useRealtimeEvent(["returns", "challans"])`
      and window focus listener to revalidate job worker challan balances in the
      background, preventing stale balance and over-receipt checks.
- [ ] **A26 · `packing.tsx` recomputes `netWt` on every keystroke.**
      `ui/pages/packing.tsx:613` — `updateSaleRow` re-derives `gross - tare`
      on each gross/tare change, discarding a manually entered net weight.
      `raw-material.tsx:538` documents this as intended ("stays manually
      editable until a weight changes again") and packing copy at :828
      makes the same claim while the code re-derives unconditionally.
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

- [ ] **A32 · `invites` has no unique constraint.**
      `db/schema.ts:173` — the pending check is a read-then-write, so two
      concurrent invites both insert; `findPendingMembership` picks the
      first by `createdAt` and the other row is orphaned, weakening the
      `already_pending` guard.
- [ ] **A34 · `overReceiptQty` has no cap.**
      `lib/document-pipeline.ts:567` — a 999,999 kg return against 10 kg is
      accepted, flagged, and written as a dyed stock `in`; a typo inflates
      stock 1000×.
- [ ] **A44 · Web `robots.ts:6` allows everything** with no `disallow`, so
      `/api/inquiry` is exposed to crawlers. The 3.7MB of design-compare
      galleries (`challan`/`sticker`/`report-styles-compare.html` under
      `apps/app/design-compare/`) are also reachable; nothing in `apps/web`
      links to them.
- [ ] **A45 · Web polish.** `SiteHeader` lifted-card style duplicated in
      four places (a sync hazard); product images served at ~3× needed
      resolution (`images.unoptimized` with 1024px sources at ≤440px
      render); `ProductIndex` filters announce nothing to screen readers
      unlike `ShadeExplorer`'s `aria-live`; no `error.tsx`/`loading.tsx` for
      the dynamic `/links` and `/contact` routes; `not-found.tsx` copy
      suggests escapes its single button doesn't offer.

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

## 2. Android device pass (owner)

- [ ] **F4 · Device pass (owner):** motion feel, sheet drag, QR camera,
      toast stack, date sheet at real phone size.

## 3. Deferred from the parity pass

- [ ] **D1 · Blur surfaces everywhere** once B3 is decided (header, sheet
      scrims, frosted glass).
- [ ] **D3 · Breathing room:** `Field` label typography (web form labels
      12px/600 vs kit 13px/500; `design.md` Section 3 says 13px medium) — align one
      way, then update the other.

## 4. Code cleanup

Each item lists the files, the risk, and what "done" requires.

### Priority 1 — do when touching the area

- [ ] **C1 · Shared editor-shell for packing / raw-material / returns.**
      Files: `apps/app/src/main/ui/pages/packing.tsx` (~1.3k lines),
      `raw-material.tsx` (~1k), `returns.tsx` (~1k). All three repeat
      `useMastersLoad` + `useDirtyGuard` + `countLabel`/`TableSkeleton` +
      identical Details/Items `CardHeader` blocks and parallel
      create/update POST/PUT pairs. Risk HIGH — the three riskiest pages.
      Extract chrome only (headers, skeletons, dirty guard, masters-load,
      save plumbing), never fields. Done when a new
      `components/editor-shell.tsx` (or `useEditorForm`) is consumed by all
      three; `tsc`, `lint`, manual create+edit smoke on all three forms.
      `PackingImportDialog` is already extracted to
      `components/packing-import-dialog.tsx` and `challans-editor.tsx` already
      uses `useMastersLoad` — both are the pattern.

### Priority 2 — structural, needs test cover first

- [ ] **C2 · Split `document-pipeline.ts` (1,288 lines).** Shape:
      `pipeline/{challans,returns,raw,packing,common}.ts`; move, don't
      rewrite; keep every export name stable (`createChallan`,
      `updateReturn`, `returnedTotalsByChallan`, `jobWorkBalances`, …). Also
      fold in the repeated `fyForDate(…).label !== …` FY guard, the
      `resolveSupplier`/`resolveParty`/`resolveReturnParty` trio → one
      helper, and standardize ~8 raw `new Date().toISOString()` on `toIso()`.
      Done when `tsc -p tsconfig.server.json` + a full
      challan/return/raw/packing create+update smoke passes.
- [ ] **C3 · Split `challan-html.ts` (443 lines) + golden-file test.**
      That file holds types + pagination + CSS string + builders, shared by
      the server PDF, desktop PDF and print page. Snapshot-test
      `buildChallanHtml` output as a golden file FIRST, then split into
      `challan-{types,css,sheet}.ts` with byte-identical output. Done when
      the golden test is green before and after and all three PDF/print
      pipelines smoke-test.
- [ ] **C5 · Dedupe the mirrored helpers.** `scripts/publish-releases.ts`
      re-implements `hasUpdateFloor`/`compareSemver`/`CONTENT_TYPES` from
      `packages/shared` and `src/server/lib/releases.ts` (drift hazard);
      `electron/build.ts` vs `electron/dev.ts` duplicate the main+preload
      Bun build. Unify behind one home per helper when touching the area.

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
