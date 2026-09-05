# Decisions pending — owner call

Found in the repo-wide audit (working tree, uncommitted). Each item needs a
decision before code changes. Nothing here is breaking today.

## 1. Edit routes re-implement the document pipeline

- `apps/app/src/server/routes/returns.ts` — PUT duplicates `createReturn` from
  `apps/app/src/server/lib/document-pipeline.ts`.
- `apps/app/src/server/routes/raw-material.ts` — PUT duplicates `createRawMaterial`.
- `apps/app/src/server/routes/packing.ts` — PUT duplicates the `createPacking`
  item-building.

Options: add `updateReturn` / `updateRawMaterial` / `updatePacking` adapters in
`document-pipeline.ts` (mirroring `updateChallan`), or accept the duplication.

Related duplications, same decision:

- `allocatedChallanNumber` (document-pipeline.ts) vs `allocateEntryNumber`
  (`apps/app/src/server/lib/company.ts`) — same CAS counter loop, two copies.
- `GET /returns/balance/:jobWorkerId` (returns.ts) vs `/reports/job-work-balance`
  (`apps/app/src/server/routes/reports.ts`) — same outward + grouped-returns logic.
- Net-weight auto-calc: `packing.tsx` (`.toFixed(3)`) vs `raw-material.tsx`
  (`round3Str`) — one helper would do.

## 2. Non-null assertions across server routes

~60 `c.get("member")!` / `c.get("auth")!` shortcuts. Repo rule bans `!`.
Cleanest fix: type the Hono env so `c.get` returns non-optional after
`resolveMember`, or narrow once per route. Pattern change — pick one.

## 3. Write-only database columns

Written, never read by any route:

- `qr_logins.ip` — `apps/app/src/server/auth/qr-login.ts`
- `devices.userAgent` — `apps/app/src/server/auth/session.ts` (device list
  could return it)
- `invites.invited_by` — `apps/app/src/server/auth/members.ts` (pending-member
  list could return it)
- `challans.client_ref` / `challans.origin_device` — written by
  `document-pipeline.ts`, never in `toChallanDto`

Decide per column: surface it in a response, or drop it in the next migration.

## 4. Rate limits that only live in memory

`/api/auth/lookup` (exists/has-password oracle) and the CPU-heavy
`GET /api/challans/:id/pdf` are guarded only by per-isolate in-memory IP
budgets (`apps/app/src/server/auth/otp.ts`). Cloudflare runs many isolates, so
parallel requests multiply the limit. Accept as residual risk, or move
per-identifier / per-endpoint ceilings into D1 like the OTP and password
counters.

## 6. Native builds on every push to main

`.github/workflows/app-build.yml` runs all 3 desktop builds + the APK job on
every push to `main` that touches `apps/app/**`. DEPLOY.md now documents this.
If they should run on manual dispatch only, add an `if` to the `desktop` and
`android` jobs.

## 7. Mobile item-row inputs lack accessible names

`challans-editor.tsx`, `packing.tsx`, `raw-material.tsx`, `returns.tsx` — the
mobile (<sm) item rows render inputs/selects with no `id`/`htmlFor`/`aria-label`
(desktop grids do it right). ~50 inputs across 4 files; needs label review per
field.

## 8. Settings page: numbering UI for packing series doesn't exist

`apps/app/src/main/ui/pages/settings.tsx` — `TYPE_LABELS` / `TYPE_HINTS` define
`packing_s` / `packing_j` rows, but `NumberingGroup` only renders
sales / outward / raw. Either render the two packing groups or delete the
entries (and slim the type).
