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

## 1b. Findings from the 2026-09-14 full audit (all verified by reading code)

Every item below was confirmed against the actual code. Fix targets
`apps/app`; business-app changes land in BOTH shells (AGENTS.md §2.3).

### Critical

- [x] **A1 · Android routine APK update path is dead.**
      Audited against the pre-commit tree; commit `0c13374` already fixed it
      (`if (detectHost() !== "web") set({ status: "ready" })` — Android arms
      the Settings Update action, macOS arms the banner, web stays idle).
- [x] **A0 · The blocking "Update required" dialog fired on every manifest
      read, on every shell.** `src/main/store/updates.ts:173` did
      `if (manifest.minVersion)`, and the published manifest carries
      `minVersion: "0.0.0"` — a truthy string, so `markRequired("0.0.0")`
      armed the undismissable dialog on web and Android alike. Fixed
      2026-09-15: the floor is ignored unless it is a non-zero semver, and
      `update-dialog.tsx` now also refuses to render a zero floor.
- [ ] **A2 · `resolveMember` can serve the wrong workspace.**
      `src/server/auth/perms.ts:47` takes `memRows[0]` with no `ORDER BY`;
      `memberships` carries only the composite `(userId, workspaceId)` PK —
      no unique index on `userId`. `routes/members.ts:64` enforces "one
      workspace per account" in app logic alone. A user holding two
      memberships is scoped to whichever row D1 returns first: silent
      cross-workspace data access with no error.
- [ ] **A3 · `printPage()` fires `window.print()` on Android.**
      `src/main/lib/platform.ts:125` — its docstring says it is a no-op in
      the Android WebView (challan pages route through the share sheet), but
      the body does not implement the guard. `ui/pages/challans-print.tsx:69`
      auto-fires it 350ms after the sheet renders.

### High

- [ ] **A4 · Deep links never wired + HTTPS filter missing.**
      `src/main/lib/platform.ts:414` exports `initAndroidDeepLinks` — no
      caller anywhere. `AndroidManifest.xml:26` registers only `kataria://`,
      not the release origin `https` `/login/scan/<code>` filter that
      `apps/android/APP.md:118` documents. Production QR-approve links land
      on a blank screen.
- [ ] **A5 · `colors.stockType` is mutable, corrupting the stock ledger.**
      `routes/masters.ts:241` allows the `raw`/`dyed` flip; `lib/stock.ts:60`
      freezes the type into each `stock_entries` row at write time. After a
      flip the same physical yarn sits in two buckets with contradictory
      totals. No validation blocks it.
- [ ] **A6 · Deleting a color/denier can strand stock and document rows.**
      `routes/masters.ts:140` only catches `FOREIGN KEY constraint failed`,
      but `lib/db.ts:9` sets no `PRAGMA foreign_keys=ON` and its comment
      claiming D1 enforces FKs itself is wrong (SQLite defaults to off). If
      the check never fires, deleting a color still referenced by
      `stock_entries` orphans rows or deletes a color a ledger points at.
- [ ] **A7 · Sync-dialog Retry swallows failures.**
      `ui/components/sync-dialog.tsx:217` — `try { await retryErrored(...)
    } finally { setBusy(false) }` with no `catch`. The button re-enables
      with no error text, no toast, and a floating unhandled rejection — on
      the one screen whose job is to report queue state.
- [ ] **A8 · Every `<Select>` opens ~2× slower than its own contract.**
      `ui/components/ui/select.tsx:74` — `duration-[380ms]` open /
      `duration-300ms` close with the morph spring curve. `design.md` §3
      contracts dropdowns/popovers to ≤180ms and §5.6 says floating menus
      keep the fast timing, not the morph grammar. 380ms is the
      notification-banner dwell — the wrong grammar on every menu.
- [ ] **A9 · Offline challan numbering converts a clash into a raw 500.**
      `lib/document-pipeline.ts:1001` — the batch catch shapes `UNIQUE
    constraint failed` into a 409 only when `input.offline` is set, and
      the clash pre-check is TOCTOU. Two devices issuing offline numbers can
      both pass it; one then gets an unexplained 500.
- [ ] **A10 · Raw `YYYY-MM-DD` dates on the two most-used screens.**
      `ui/pages/challans-detail.tsx:217` and `challans-list.tsx:473,554`
      render `{challan.date}` / `{c.date}` as `2026-09-03`, while
      `packing.tsx:423` and `returns.tsx:374` print `03 Sep 2026` via
      `fmtDate`. `dashboard.tsx:400` compounds it: `.toFixed(3)` bypasses
      `fmtWt`, so no en-IN grouping anywhere on the dashboard weights.
      Related to W4.
- [ ] **A11 · Members permission editor can wipe a concurrent change.**
      `ui/pages/members.tsx:242` — `draftPerms` is seeded from
      `member.permissions` once and never re-synced. A realtime update or a
      second admin save landing while the editor is open is silently
      overwritten by Save.
- [ ] **A12 · `challans-list` page is never clamped to `pageCount`.**
      `ui/pages/challans-list.tsx:181` — after a delete or FY switch shrinks
      `total`, `page` can exceed `pageCount`. The pager is gated on
      `pageCount > 1`, so it disappears and the register shows an empty
      table with no way back except changing the filter.
- [ ] **A13 · Web SEO: no `og:image`, Twitter card, or canonical URL.**
      `apps/web/src/app/layout.tsx:12` — one `openGraph` reference
      site-wide (`siteName` + `type` only); no `twitter` block, no
      `alternates.canonical`, so `metadataBase` is dead config. Sharing any
      page renders a text-only card. No JSON-LD on product detail pages
      either — the highest-value SEO spot on the site.
- [ ] **A14 · Web mobile nav clips in landscape.**
      `apps/web/src/components/layout/SiteHeader.tsx:112` —
      `DialogContent` is `fixed inset-0` with no `overflow-y-auto`; ~504px
      of content in a 390px-tall viewport clips the last links and "Send
      inquiry". Portrait is fine, which is why it ships.

### Medium

- [x] **A15 · Stale docs describing the removed prompt-mode SW flow.**
      `src/main/sw.ts` and `vite.config.ts` still described SKIP_WAITING /
      banner-on-ready. Fixed 2026-09-15 alongside A0 — both now describe the
      self-applying flow. (The `showUpdateBanner` guard was re-checked and
      is correct, not vestigial: `desktopBridge() === null` returns before
      the macOS-only final line, so it is reached on desktop alone.)
- [ ] **A16 · QR login polls overlap and never stop on success.**
      `ui/components/qr-login-panel.tsx:57-80` — async tick on a 3s interval
      with no overlap guard (a slow network runs two `pollQrLogin` calls,
      applying results out of order), and on `status === "ok"` the timer is
      never cleared — polling continues until the redirect unmounts it.
- [ ] **A17 · GSTIN has maxLength but no format check.**
      `ui/pages/masters.tsx:526` — `"ABCDEFGH"` saves as a GSTIN and later
      prints on a challan; the submit gate at :242 only tests `name.trim()`.
- [ ] **A18 · `POST /api/members/invite` has no rate-limit budget.**
      `routes/members.ts:36` — returns three distinguishable outcomes
      (`phone_already_registered` 409 / `attached: true` / `attached:
    false`), an enumeration oracle, but unlike `/lookup` it never calls
      `consumeBudget`.
- [ ] **A19 · `POST /api/challans/:id/pdf` has no permission gate.**
      `routes/challans.ts:314` — `requireAuth` + `resolveMember()` only; a
      member with zero permissions can render PDFs (consuming the
      per-user-limited Browser Run budget). Every sibling write route is
      gated, so the omission looks accidental.
- [ ] **A20 · Settings: Enter in a numbering input saves the company form.**
      `ui/pages/settings.tsx:354-397` — the numbering `<MorphGroup>` and its
      Save button sit outside the company-details `<form>`; Enter inside a
      prefix/digits/suffix input silently fires `saveCompany` and saves
      nothing numbering-related.
- [ ] **A21 · Devices failure looks identical to "no devices".**
      `ui/pages/devices.tsx:98` — `refreshDevices().catch(() => {})`
      swallows the failure and the render branch only distinguishes
      `length === 0`. An offline launch shows the permanent empty state with
      no error text and no Retry.
- [ ] **A22 · `UpdateDialog` on web can become an undismissable dead end.**
      `ui/components/update-dialog.tsx:93` → `store/updates.ts:239` —
      `installUpdate()` on web now does only `if (requiredMinVersion)
    window.location.reload()`. If the 426 floor fires before the SW has
      precached the new build (install failed, deploy too fresh), the reload
      re-serves the old shell, 426s again, and the button can never work —
      with no error shown.
- [ ] **A23 · `site.url` falls back to a `workers.dev` subdomain.**
      `apps/web/src/content/site.ts:9` — `NEXT_PUBLIC_SITE_URL` is set in
      neither `wrangler.jsonc` nor the CI workflow, so the fallback is the
      baked production value, feeding `metadataBase`, `sitemap.xml`,
      `robots.txt` and the `/links` Website row.
- [ ] **A24 · `/links` open/closed status never refreshes.**
      `apps/web/src/app/links/page.tsx:12` — server-computed once with no
      client re-check; a page opened at 6:55 PM shows "Open now · till 7:00
      PM" past closing, wrong for the exact visitor who needs it.
- [ ] **A25 · Returns editor uses a stale balance snapshot.**
      `ui/pages/returns.tsx:475` — in edit mode the job-worker select is
      disabled and balances are fetched once at load; the per-row Challan
      select and the over-receipt warning (:1010) compare against that
      snapshot for the whole session. A return recorded on another device
      while the form is open silently under-warns.
- [ ] **A26 · `packing.tsx` recomputes `netWt` on every keystroke.**
      `ui/pages/packing.tsx:613` — `updateSaleRow` re-derives `gross - tare`
      on each gross/tare change, discarding a manually entered net weight.
      `raw-material.tsx:538` documents this as intended ("stays manually
      editable until a weight changes again") and packing copy at :828
      makes the same claim while the code re-derives unconditionally.
- [ ] **A27 · Three editor pages show a stale, blocking `detailError`.**
      `returns.tsx:668`, `packing.tsx:768`, `raw-material.tsx:660` —
      `{detailError ?? error}` means a save failure is invisible whenever
      the detail also failed to load, and `detailError` is only cleared by
      remount. Once "Editing is disabled" appears it blocks every later
      submit even if the entry loaded on a retry.
- [ ] **A28 · Electron PDF partition allows `data:`/`blob:` with no CSP.**
      `electron/main.ts:410` — mitigated (HTML is app-generated, validated
      `<!DOCTYPE html>`, ≤10MB, `javascript: false`) but not closed.
- [ ] **A29 · `InstallerPlugin.java` has no origin allowlist on `installApk`.**
      `:44` — the JS side validates `startsWith("/releases/")`, but the
      plugin accepts any `https://` URL and hands it to the system
      installer: an arbitrary-APK-install primitive if the renderer is ever
      compromised.
- [ ] **A30 · `challan_has_returns` check is TOCTOU on update and delete.**
      `lib/document-pipeline.ts:1207` — SELECT then later batch; a return
      recorded in the gap hits a non-cascading FK and the batch fails as a
      500 on a path with no FK catch (unlike `masters.ts:159`).

### Low

- [ ] **A31 · `otp_codes.code` declares `length: 10` but stores 64 chars.**
      `db/schema.ts:129` — `requestOtp` stores `sha256Hex` (64 chars).
      SQLite does not enforce `text(n)`, so it works, but the declared
      length misdescribes storage.
- [ ] **A32 · `invites` has no unique constraint.**
      `db/schema.ts:173` — the pending check is a read-then-write, so two
      concurrent invites both insert; `findPendingMembership` picks the
      first by `createdAt` and the other row is orphaned, weakening the
      `already_pending` guard.
- [ ] **A33 · `getChallanBalances` and `jobWorkBalances` disagree on `sent`.**
      `lib/document-pipeline.ts:695` sums `challan_items.net_wt` while
      `:657` uses the header `challans.totalNetWt`. The two can diverge
      after an item edit that doesn't recompute the header, so the balance
      report and the return form show different figures for one challan.
- [ ] **A34 · `overReceiptQty` has no cap.**
      `lib/document-pipeline.ts:567` — a 999,999 kg return against 10 kg is
      accepted, flagged, and written as a dyed stock `in`; a typo inflates
      stock 1000×.
- [ ] **A35 · `deleteCookie` omits `httpOnly`/`sameSite`.**
      `routes/auth-session.ts:45,91` — Hono overwrites the attributes, so
      the cleared cookie is set without them.
- [ ] **A36 · `update-dialog.tsx:97` swaps the button label to
      "Downloading…".** `ui/button.tsx:46` defines `loading` as disabled +
      dim + `aria-busy`, "the label never changes and nothing is injected" —
      the label change duplicates the signal on the one undismissable
      surface.
- [ ] **A37 · `packing-import-dialog.tsx:148` rows lack checkbox semantics.**
      Each row is a `<div onClick>` with no `role="checkbox"`,
      `aria-checked`, or keyboard handler — the 44px hit area reads as
      inert content to screen readers.
- [ ] **A38 · `use-camera-scanner.ts:67` discards `video.play()`.** If
      playback is blocked the rejection is unhandled and `scanError` is
      never set: a live-looking loop that silently never decodes, with no
      manual-entry fallback.
- [ ] **A39 · `sync-dialog.tsx:240` calls `listPending()` in render with no
      subscription.** The comment claims background sync changes appear
      without reopening, but re-renders only come from `useSync()` or a
      local `setTick`; a conflict resolved on another device sits stale.
- [ ] **A40 · Small control-size misses vs the contract.**
      `update-surface.tsx:67` dismiss button is `size-7` (28px) on desktop
      against §2.7's 32px floor (the coarse-pointer 44px case is right);
      `dialog.tsx:129` close button is `rounded-md` where §2.7 wants a
      circle; `select.tsx:105` items compute to 32px against §3's 36px.
- [ ] **A41 · `recipe-detail.tsx:283` sends a negative result through
      `toastSuccess`.** "No recipe saved…" renders in success color with a
      check glyph, against §2.5's "status colors used for state, never
      decoration".
- [ ] **A42 · `reports.tsx:227` has no debounce** (unlike `challans-list`
      :201's 200ms), so each date-picker change fires a request; the
      `columns` array is also fresh each render, so the hiddenCols effect
      runs on every render.
- [ ] **A43 · Dead/duplicated code.** `worker.ts:81` exports `RealtimeRoom`
      that `index.ts` never imports (wired via `wrangler.jsonc` class_name);
      `document-pipeline.ts:63` `allocatedEntryNumber` /
      `allocatedChallanNumber` are near-identical; four `Map.get` non-null
      `!`s (`:164,366,564,921`) rely on validation-by-convention;
      `download.tsx:80` UA-sniffs outside `platform.ts` and drifts from
      `detectPlatformLabel()` (the two disagree on iPads); `SectionHead.as`
      is a prop no call site passes.
- [ ] **A44 · Web `robots.ts:6` allows everything** with no `disallow`,
      exposing `/api/inquiry` and the stray compare pages; 708KB of design
      compare pages ship in `apps/web/public/` and are crawlable,
      referenced only from `apps/app` docs.
- [ ] **A45 · Web polish.** `SiteHeader` lifted-card style duplicated in
      four places (a sync hazard); product images served at ~3× needed
      resolution (`images.unoptimized` with 1024px sources at ≤440px
      render); `ProductIndex` filters announce nothing to screen readers
      unlike `ShadeExplorer`'s `aria-live`; no `error.tsx`/`loading.tsx` for
      the dynamic `/links` and `/contact` routes; `not-found.tsx` copy
      suggests escapes its single button doesn't offer.

### Cross-cutting notes

- **The 426 version gate is compiled out.** `minAppVersion` is `0.0.0` in
  `apps/app/package.json`, so `VERSION_GATE_ENABLED` is false and every
  request from any build passes. Presumably deliberate until a breaking
  release cuts — confirm, since it means `update-dialog.tsx` isn't
  reachable from the server side today.
- **Invariant enforcement is one-layered in three places** (A2, A5, A6):
  a rule assumed by the consumer but enforced only by one producer. That
  is the shape that breaks when a new caller skips the guarded path.
- **`finally` without `catch` appears twice** (A7, A21) — same silent
  failure, same fix.
- **Verified clean, do not re-audit:** no SQL injection (all Drizzle, raw
  SQL parameterized); constant-time OTP/password compares with dummy-hash
  enumeration defense; every workspace-scoped read filtered by
  `workspaceId`; no spinners (skeletons only); `packages/app-core` has zero
  DOM access; Electron preload minimal with `contextIntegration`/`sandbox`
  and thorough IPC origin validation; web hydration safe (seeded PRNG,
  `getServerSnapshot`), reduced motion genuinely respected, fonts fully
  self-hosted. The uncommitted diff's new code (`lazy-route.ts`, Electron
  cache headers, `reloadOnStaleAndroidBundle`) was checked and is correct.

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
