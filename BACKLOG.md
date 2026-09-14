# BACKLOG — focus list

Owner picks items from here; an agent takes one ID and executes it under the
rules in `AGENTS.md` (§2.3 parity, §2.4 verification, §4.1 decision
authority). Every item carries enough context to start cold. Delete an item
when it ships; history lives in git.

## 1. Owner decisions (blocked on a call)

- [ ] **B5 · Repo-wide `format:check` fails on Windows CRLF.**
      Pre-existing; every non-Android file is flagged on this machine. Fix
      via `git add --renormalize .` in a dedicated commit or
      `endOfLine: "auto"` — owner picks.
- [ ] **B6 · Version bump / release.**
      `AGENTS.md` §4.0.1: bump `apps/app/package.json` `version` when a
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

## 3. Android device pass (owner)

- [ ] **F4 · Device pass (owner):** motion feel, sheet drag, QR camera,
      toast stack, date sheet at real phone size.

## 4. Deferred from the parity pass

- [ ] **D1 · Blur surfaces everywhere** once B3 is decided (header, sheet
      scrims, frosted glass).
- [ ] **D3 · Breathing room:** `Field` label typography (web form labels
      12px/600 vs kit 13px/500; `design.md` §3 says 13px medium) — align one
      way, then update the other.

## 5. Android: open Capacitor decisions

The Android app is a Capacitor shell over the `apps/app` bundle
(`apps/android` — see its APP.md). Two native features have no official
Capacitor plugin and stay open:

- [x] **C1 · APK self-update — custom plugin, built (owner decided).**
      `InstallerPlugin.java` (registered in `MainActivity`, no npm package)
      streams the APK to app-private cache with progress events and fires
      the system installer via the FileProvider URI. Wired through the
      shared update store + blocking dialog. Java never compiled locally
      (no Android SDK on this machine) — CI `assembleRelease` is the first
      compile; verify install flow on a real phone.
- [x] **C2 · PDF print — accepted as share sheet (owner decided).**
      `@capacitor/share` covers sending the PDF to Drive, WhatsApp or a
      print app; no native print plugin needed.
