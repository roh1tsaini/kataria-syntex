# Cleanup backlog — remaining work

Each item lists the files, the risk, and what "done" requires.

## Priority 1 — do when touching the area

### 1. Shared editor-shell for packing / raw-material / returns

- Files: `apps/app/src/main/ui/pages/packing.tsx` (~1.3k lines),
  `raw-material.tsx` (~1k), `returns.tsx` (~1k).
- Why: all three repeat `useMastersLoad` + `useDirtyGuard` +
  `countLabel`/`TableSkeleton` + identical Details/Items `CardHeader` blocks
  - parallel create/update POST/PUT pairs.
- Risk: HIGH — the three riskiest pages. Extract chrome only (headers,
  skeletons, dirty guard, masters-load, save plumbing), never fields.
- Done when: new `components/editor-shell.tsx` (or `useEditorForm`) consumed
  by all three; `tsc`, `lint`, manual create+edit smoke on all three forms.
- Note: `PackingImportDialog` already extracted to
  `components/packing-import-dialog.tsx`; `challans-editor.tsx` already on
  `useMastersLoad` — use both as the pattern.

## Priority 2 — structural, needs test cover first

### 4. Split `document-pipeline.ts` (1,288 lines)

- File: `apps/app/src/server/lib/document-pipeline.ts`.
- Shape: `pipeline/{challans,returns,raw,packing,common}.ts`; move, don't
  rewrite; keep every export name stable (`createChallan`,
  `updateReturn`, `returnedTotalsByChallan`, `jobWorkBalances`, …).
- Also fold in: the repeated `fyForDate(…).label !== …` FY guard, the
  `resolveSupplier`/`resolveParty`/`resolveReturnParty` trio → one helper,
  and standardize ~8 raw `new Date().toISOString()` on `toIso()`.
- Done when: `tsc -p tsconfig.server.json`, full challan/return/raw/packing
  create+update smoke (offline conflict path included).

### 5. Split `challan-html.ts` (443 lines) + golden-file test

- File: `apps/app/src/shared/challan-html.ts` (types + pagination + CSS
  string + builders, shared by server PDF, desktop PDF, print page).
- First: snapshot-test `buildChallanHtml` output as a golden file, THEN
  split into `challan-{types,css,sheet}.ts` with byte-identical output.
- Done when: golden test green before and after; all three PDF/print
  pipelines smoke-tested.

### 6a. Offline sync integration test (follow-up to the 2026-09-08 split)

- The sync split (see done list) moved code verbatim without the integration
  test this file originally required. Still open: a test on the
  conflict → resubmit → settled path (queue loss / double-sync risk).

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
