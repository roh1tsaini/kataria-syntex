# Cleanup backlog — do later (owner)

Created 2026-09-07 after an assisted cleanup pass (see git history ~Sep 7:
dead-feature removal, dep/script pruning, endpoint consolidation, UI dedup).
Everything below was triaged but deliberately left. Each item lists the
files, the risk, and what "done" requires. Work top-down by priority.

## Priority 1 — do when touching the area

### 1. Shared editor-shell for packing / raw-material / returns
- Files: `apps/app/src/main/ui/pages/packing.tsx` (~1.3k lines),
  `raw-material.tsx` (~1k), `returns.tsx` (~1k).
- Why: all three repeat `useMastersLoad` + `useDirtyGuard` +
  `countLabel`/`TableSkeleton` + identical Details/Items `CardHeader` blocks
  + parallel create/update POST/PUT pairs.
- Risk: HIGH — the three riskiest pages. Extract chrome only (headers,
  skeletons, dirty guard, masters-load, save plumbing), never fields.
- Done when: new `components/editor-shell.tsx` (or `useEditorForm`) consumed
  by all three; `tsc`, `lint`, manual create+edit smoke on all three forms.
- Note: `PackingImportDialog` already extracted to
  `components/packing-import-dialog.tsx`; `challans-editor.tsx` already on
  `useMastersLoad` — use both as the pattern.

### 2. Dashboard `cachedSummary` → challans store
- File: `apps/app/src/main/ui/pages/dashboard.tsx:425` (module-level mutable
  cache keyed by workspace id).
- Why: survives logout/account-switch within a session (stale-workspace
  numbers) and bypasses the challans store.
- Risk: MED — must preserve instant-cached first paint.
- Done when: cache lives in `useChallans` (e.g. `summaryCache`) or is
  cleared in `logout()`; dashboard still paints instantly on remount.

### 3. `index.html` origin injection at Vite-time
- Files: `apps/app/index.html` (`https://CHANGE_ME_APP_ORIGIN`),
  `.github/workflows/app-build.yml` (CSP sed-rewrite + inline `bun -e`
  rewrite), `apps/app/electron/main.ts` (`app://bundle` handling).
- Why: CI mutates a tracked source file on the runner; placeholder leaks
  into WebViews if a sync happens before injection.
- Risk: MED — replacement must preserve the exact `connect-src` contract.
- Done when: `__APP_ORIGIN__` define or `transformIndexHtml` plugin injects
  at build time; CI rewrite steps deleted; packaged + local builds verified.

## Priority 2 — structural, needs test cover first

### 4. Split `document-pipeline.ts` (1,287 lines)
- File: `apps/app/src/server/lib/document-pipeline.ts`.
- Shape: `pipeline/{challans,returns,raw,packing,common}.ts`; move, don't
  rewrite; keep every export name stable (`createChallan`,
  `updateReturn`, `returnedTotalsByChallan`, `jobWorkBalances`, …).
- Also fold in: the repeated `fyForDate(…).label !== …` FY guard, the
  `resolveSupplier`/`resolveParty`/`resolveReturnParty` trio → one helper,
  and standardize ~8 raw `new Date().toISOString()` on `toIso()`.
- Done when: `tsc -p tsconfig.server.json`, full challan/return/raw/packing
  create+update smoke (offline conflict path included).

### 5. Split `challan-html.ts` (444 lines) + golden-file test
- File: `apps/app/src/shared/challan-html.ts` (types + pagination + CSS
  string + builders, shared by server PDF, desktop PDF, print page).
- First: snapshot-test `buildChallanHtml` output as a golden file, THEN
  split into `challan-{types,css,sheet}.ts` with byte-identical output.
- Done when: golden test green before and after; all three PDF/print
  pipelines smoke-tested.

### 6. Split offline `sync.ts` (266 lines)
- File: `apps/app/src/main/lib/offline/sync.ts` (zustand + probe + deliver
  + 3-pass loop + hook).
- Shape: extract `sync-state.ts`, `deliver.ts`, `conflict.ts`; leave
  `sync.ts` as orchestrator. Needs an integration test on the
  conflict → resubmit → settled path first (queue loss / double-sync risk).

### 7. `errors.ts` client/server split + prune
- File: `apps/app/src/main/ui/lib/errors.ts` (`MESSAGES`, `satisfies`
  drift-check — keep the check).
- Split `CLIENT_MESSAGES` (`network_error`, `pending_sync_edit`,
  `http_500/502`) from server codes. Prune legacy-looking codes ONLY with
  server-emission proof (old deployments may still emit them).

### 8. Dirty-guard coverage for dialog editors
- Hook covers tab-close for full-page editors; dialog editors
  (masters/colors/members) have no guard, with no comment explaining why.
- Decide: document intended coverage in the hook comment, or add a
  "discard changes?" confirm to dialogs (needs a router-blocker, not just
  more call sites — `beforeunload` doesn't cover in-app navigation).

## Priority 3 — small polish

### 9. Report date filters: honor or reject
- `over-receipts` / `stock-summary` / `party-summary` / `/reports/dashboard`
  silently ignore the `from`/`to` the reports grid always appends. Either
  honor them or reject them — not silent ignore.

### 10. `fyPrevLabel` relocation
- `apps/app/src/main/ui/lib/dashboard-math.ts` holds `fyPrevLabel` next to
  `packages/shared/src/fy.ts` (`fyForDate`/`fyLabelForDateString`). Move it
  next to shared `fy.ts` when next touching either file.

## Explicitly deferred (recommendation: never, unless forced)

- **jsqr → `BarcodeDetector`**: 1 call site (`use-camera-scanner.ts`).
  Chromium-only; Firefox/Safari still need jsqr fallback. If revisited:
  `BarcodeDetector` with jsqr fallback + lazy `import()` the scanner chunk.
- **QR named-identifier fallback removal** (`auth-qr.ts`, `qr-login.ts`):
  most intricate auth code for the rarest flow. Product sign-off required;
  full login-matrix re-verification on web + Electron + Capacitor.
- **Auth 4-router merge**: highest blast radius in the codebase. Incremental
  only (the `ALL_PERMISSIONS` filter dup is the safe first step).
- **`woven.ts` / `thread.ts` freeze**: decorative shade textures, correct but
  disproportionate. Freeze as `shade-texture` with visual regression tests;
  consider pre-rendering to static CSS/PNG only if perf bites.
- **Dialog-as-mobile-menu** (`SiteHeader`): works, tested a11y. Replace with
  popover + CSS transition only if bundle weight forces it.
- **Single-use primitives/hooks** (`input-otp`, `toggle-group`, `calendar`,
  `avatar`, `useCameraScanner`, `useCountdown`, `cn.ts` seam): correct steady
  state for vendored code. Leave alone.
- **Big-file splits** (`colors.tsx`, `dashboard.tsx`, `app-shell.tsx`):
  subcomponents only if they keep growing, never moves for their own sake.

## Already done (2026-09-07 pass — do not redo)

Dead packing→challan linkage dropped (+ migration); dead motion tokens;
`EASE`→`EASE_OUT`; duplicate `/company` fetches; dead stock guards;
`deleteSessionCookie`; `workbox-window` + `react-server-dom-webpack`
removed; dead scripts deleted; `dead-files/` removed; Capacitor output
gitignored; offline totals → `challanTotals()`; badge simplification; web
shim deletion; 8 dead query params; balance + stock endpoint consolidation
(`jobWorkBalances`, `summarizeStockLedger`); recipe count batching; shared
font-loader core (`shared/cached.ts`); transaction-log pagination fields;
loginAttempts pruning; lookup envelope; web literals batch; 14-page
AppShell→fragment strip; challan-editor `useMastersLoad` + dialog extract;
date-key unification; hours.ts simplification (109/109 behavior-proven);
CompanyInfo export; numbering `@internal` docs; dead column drops (+
migration); CI electron invocation; APP.md/DECISIONS.md consistency.
