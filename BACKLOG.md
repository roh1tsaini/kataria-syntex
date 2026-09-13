# BACKLOG — focus list

Owner picks items from here; an agent takes one ID and executes it under the
rules in `AGENTS.md` (§2.3 parity, §2.4 verification, §4.1 decision
authority). Every item carries enough context to start cold. Delete an item
when it ships; history lives in git.

## 1. Owner decisions (blocked on a call)

- [ ] **B1 · Toast exactness vs design.md §3.**
      Web (sonner) shows a description line when one is passed and dwells
      success 3.8s / error 6.5s. `design.md` §3 says "title only". Android
      (`src/lib/toasts.ts`, `src/ui/toast-overlay.tsx`) is title-only at a
      flat 4s. Pick: mirror sonner exactly (descriptions + per-kind timing,
      update `design.md`), or keep the doc and accept divergence.
- [ ] **B2 · Android-only surfaces: keep or remove for strict parity?** - challan-detail record meta block (Created/Updated/Issued-by; file
      comment claims the owner asked for it) - Retry buttons on error states (web has none) - permission-gated Edit/Delete buttons (web relies on route guards) - discard-confirm on Cancel in editors (web cancels silently) - scan-approve "Done" button - deep-link `returnTo` continuation through sign-in (web drops the code) - "Select a date." save guard (web has none) - challan editor offline number preview + save toasts were removed for
      parity — restore if that behavior was wanted.
- [ ] **B3 · Backdrop blur.**
      Web header/sheets use `backdrop-blur`; Android is solid because
      `expo-blur` is not installed. Add the Expo package (free, same vendor)
      or accept solid surfaces.
- [ ] **B4 · Android lint is a no-op.**
      `apps/android/eslint.config.mjs` matches no TS/TSX, so `bun run lint`
      silently checks nothing there. Add flat-config `files` + TS parser, or
      accept `tsc` + `expo export` as the Android gates.
- [ ] **B5 · Repo-wide `format:check` fails on Windows CRLF.**
      Pre-existing; every non-Android file is flagged on this machine. Fix
      via `git add --renormalize .` in a dedicated commit or
      `endOfLine: "auto"` — owner picks.
- [ ] **B6 · Version bump / release.**
      `AGENTS.md` §4.0.1: bump `apps/app/package.json` `version` when a
      change warrants a release; the bump is the release action. Owner call
      for the parity pass and future sessions.

## 2. Web bugs found during the parity audit (fix in `apps/app`, then mirror)

- [ ] **W1 · challan editor: failed masters load doesn't block save** — an
      empty form can overwrite a challan
      (`src/main/ui/pages/challans-editor.tsx`).
- [ ] **W2 · Update banner `bg-accent/10` compounds alpha** (~0.7% tint).
- [ ] **W3 · Drawer footer circle buttons stay 32px** on coarse pointers
      (no 44px touch floor).
- [ ] **W4 · `toLocaleString()` instead of en-IN** — reports row count,
      `devices.tsx` dates; `design.md` §2.4.2 wants `en-IN` / `DD Mon YYYY`.
- [ ] **W5 · Reports hidden columns live in global `localStorage`**, not
      keyed by workspace.
- [ ] **W6 · Outward editor mobile row says "Boxes"**, desktop says "Sacks".
- [ ] **W7 · Members empty copy says "form above"** (form is below).
- [ ] **W8 · `/auth` renders sign-in for authenticated users**; scan-approve
      drops the `returnTo` code on deep links.
- [ ] **W9 · challan-detail mobile Print/Edit/Delete are icon-only** with no
      accessible name.
- [ ] **W10 · Masters dialog title/description render as body text** (raw
      Radix primitives vs Tailwind preflight).
- [ ] **W11 · `MastersSkeleton` still draws segmented-pill tabs** instead of
      the underline grammar.

## 3. Android parity follow-ups (not blocking)

- [ ] **F1 · Missing lucide glyphs:** Dashboard (`LayoutDashboard`), Devices
      (`MonitorSmartphone`), Stock Summary (`ClipboardList`), Transaction Log
      (`ListTree`). Port as custom SVGs like the other `feather.tsx` icons.
- [ ] **F2 · Drawer RoleBadge:** `award`/`shield` replaced with
      Crown/ShieldCheck — confirm on device.
- [ ] **F3 · Panel shadows:** `SHADOWS` tokens exist in
      `src/theme/index.ts`; audit screens that render borderless panels
      without them.
- [ ] **F4 · Device pass (owner):** motion feel, sheet drag, QR camera,
      toast stack, date sheet at real phone size.

## 4. Deferred from the parity pass

- [ ] **D1 · Blur surfaces everywhere** once B3 is decided (header, sheet
      scrims, frosted glass).
- [ ] **D2 · Toast descriptions + durations** once B1 is decided.
- [ ] **D3 · Breathing room:** `Field` label typography (web form labels
      12px/600 vs kit 13px/500; `design.md` §3 says 13px medium) — align one
      way, then update the other.
