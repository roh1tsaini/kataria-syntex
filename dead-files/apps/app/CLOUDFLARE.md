# Cloudflare migration — plan & decisions

> Working doc for moving apps/app + apps/web off Google Cloud VM / Docker /
> Caddy / deSEC onto the Cloudflare free tier. Written 2026-08-30.
> SPEC.md stays the source of truth for the app; this file tracks the
> migration itself. Delete this file once the migration is done.

## Decisions (owner, 2026-08-30)

- Whole repo moves to Cloudflare. Google VM, Docker, Caddy, deSEC: all removed.
- **apps/app → Cloudflare Pages.** Static SPA + Pages Functions running the
  Hono API. Owner prefers `*.pages.dev` URLs ("looks neat").
- **apps/web → Workers via OpenNext** (Next.js 16 stays fully dynamic:
  CSP headers, inquiry route, force-dynamic pages). Pages can't run Next
  server features — owner accepts Workers for the website specifically.
- **Database → Cloudflare D1** (`drizzle-orm/d1`, async). App is in dev —
  no production users, no data migration. Schema changes (add/drop) are
  expected; fresh D1, masters re-entered by hand.
- **Old hostnames die**: `katariasyntex.dedyn.io`, `app.katariasyntex.dedyn.io`.
  Installed dev clients (Electron/APK/PWA) will point at dead origins —
  acceptable. Rebuilds get the new origin.
- **Auth: passwords hashed server-side with native scrypt** (decided
  2026-08-31) — owner rejected client-side hashing ("not safe"). `scrypt` from
  `node:crypto` via `nodejs_compat`, stored `scrypt$N$r$p$salt$hash`,
  timing-safe verify. A scrypt run (~30–80 ms CPU) exceeds the free 10 ms CPU
  limit, which is acceptable: isolates tolerate infrequent overruns, logins
  are rare, and rate-limit lockouts cap abuse. Real CPU is measured in local
  workerd before shipping.
- **Challan PDFs: pdf-lib everywhere** (decided 2026-08-31, revised) —
  shared `src/shared/pdf-template.ts` geometry rendered with `pdf-lib` on
  BOTH server (Pages Function) and offline client (Electron/Capacitor/PWA).
  Byte-identical HQ vector PDFs online and fully offline, no Browser Rendering
  quota, unlimited free. HQ design translates to template geometry; per-field
  shrink-to-fit + wrap supported.
- **Backups: D1 Time Travel only** (7-day PITR, free). No scheduled R2
  exports. Litestream removed.
- **PR preview deployments: yes** (free) via `cloudflare/wrangler-action@v4`.
- Website inquiry form: unchanged by all this — last pending decision stands
  (FIXES.md / SPEC pending list).

## Still open (owner, when ready)

1. Final project names / URLs (`kataria-app.pages.dev`, `kataria-site.workers.dev`
   proposed). Custom domain question parked; deSEC is gone either way.

## What gets deleted (implementation)

- `apps/app/Dockerfile`, `apps/web/Dockerfile`, root `.dockerignore`
- `apps/app/deploy/` — entire folder (Caddyfile, compose, setup-vm.sh,
  deSEC updater units, Caddy override, Litestream config + units, restore
  script)
- `.github/workflows/deploy.yml` — replaced by a Cloudflare deploy workflow
- Docs references to GCP/VM/Docker/deSEC (SPEC/AGENTS already updated)

(Per repo policy dead files are archived to `dead-files/`, not deleted.)

## What changes (implementation)

- `src/server/lib/db.ts`: `bun:sqlite` sync drizzle → `drizzle-orm/d1`;
  per-request `env.DB`; boot-time pragmas/migrations gone.
- All sync call sites (`.run()`/`.all()`/sync `db.transaction`) → async;
  multi-statement invariants via `db.batch()` (single transaction).
  Affected: `lib/document-pipeline.ts`, `lib/stock.ts`, `lib/company.ts`,
  `lib/masters.ts`, `routes/auth.ts`, `routes/health.ts`, everything in
  `routes/` using the sync driver.
- `lib/migrate.ts`: fs-based boot migrator → Drizzle-generated SQL applied
  by `wrangler d1 migrations` (CI), never at runtime.
- `index.ts`: Bun default-export + `hono/bun` static → Pages Functions
  entry (`functions/api/[[route]].ts`) + Pages static assets for the SPA.
- `auth/otp.ts`: in-memory rate-limit `Map` → D1-backed buckets;
  `Buffer` → portable crypto. `lib/password.ts`: native scrypt via
  `nodejs_compat` (see SPEC "Password storage model"). `c.env.incoming.socket`
  → `CF-Connecting-IP`. `process.env` → Function env bindings.
- `lib/pdf.ts` → `pdf-lib` (was `pdfkit`) using the same shared template as
  offline; `routes/challans.ts` returns the pdf-lib bytes. `pdfkit` deleted;
  no Browser Rendering binding needed.
- Client config: `VITE_API_URL` / Electron `KC_API_ORIGIN` / CSP origins /
  `apps/web` `connect-src` → new Cloudflare origins (names TBD — single
  constant per shell so the URL swap is one-line later).
- Local dev: API dev moves from `bun run dev:server` to `wrangler pages dev`
  (workerd runtime matches prod); Vite UI on :1420 unchanged.
- CI: new `cf-deploy.yml` (wrangler-action@v4, both projects, PR previews);
  `app-build.yml` keeps shipping desktop/Android, new baked origins.
  GitHub secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` —
  owner-only setup.
- `nodejs_compat` compat flag on both projects for any node: APIs that
  remain; `compatibility_date` pinned at setup.

## Status 2026-08-31 — implementation complete, verified

- Server fully converted to async D1 (`getDb(c.env.DB)` per request, no
  singleton; `db.batch()` for pure multi-write invariants, async
  `db.transaction()` where intermediate reads are needed). Typecheck (client +
  server + electron), lint, format, and both production builds green.
- **2026-08-31 runtime fix:** drizzle-orm/d1's `db.transaction()` issues a raw
  `BEGIN` that D1 rejects ("Failed query: begin") — interactive transactions
  don't exist on D1 despite the typings. All six sites (signup, 4 document
  create flows, ownership transfer) now use standalone CAS updates (counter
  allocation keeps its retry loop) + one `db.batch()` for the writes; unique
  indexes backstop duplicates. Signup verified end-to-end on local workerd.
- Ran locally on workerd (`wrangler pages dev`): `/api/health`, `/api/health/db`
  (real D1 query), SPA serving, and JSON `not_found` all verified. All three
  drizzle migrations apply via `wrangler d1 migrations apply`.
- apps/web: real `@opennextjs/cloudflare` + `wrangler` installed; the
  hand-rolled `opennext-shim.d.ts` that shadowed the package is deleted;
  `wrangler types` generates `cloudflare-env.d.ts`; `CloudflareEnv` extended
  with `INQUIRY_DB` in `src/types/bindings.d.ts`. Web typecheck + build green.
- CI: `.github/workflows/cf-deploy.yml` created (push-to-main deploys both
  projects + applies D1 migrations; PRs get Pages preview deployments for the
  app only — Workers previews not wired, say the word if you want them).
- Local dev: `bun run dev:server` is now `wrangler pages dev`;
  `bun run db:migrate:local` applies migrations to the local D1.

### Behavior notes (owner awareness)

- Client IP for rate limiting now defaults to `CF-Connecting-IP` (edge-set,
  unspoofable); the old rightmost-XFF path stays behind a `TRUST_PROXY=1` var.
- Stock type for items without a color defaults to `"raw"` (was `"dyed"`) —
  unreachable in practice because `validateMasters` rejects unknown colors.
- Final project names still TBD (owner picks at deploy time); client origin
  constants stay one-line swaps until then.

## Owner tasks (deploy — never done by the agent)

1. Create/confirm the Cloudflare account (free).
2. `wrangler d1 create kataria-app` → paste the real id into
   `apps/app/wrangler.jsonc`; `wrangler d1 create kataria-web-inquiry` →
   paste into `apps/web/wrangler.jsonc`.
3. Pick final names; create the Pages project + Worker, set the
   `APP_URL` repo variable (native builds bake it in).
4. GitHub secrets: `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.
5. Secrets via `wrangler pages secret put` (PINGRAM_API_KEY etc.) and
   `.dev.vars` locally.
6. First real deploy + smoke test on the free URLs.

## Verified facts this plan relies on (2026-08-30)

- Workers free: 100k req/day, 10 ms CPU/req, cron OK. Pages static assets:
  unlimited/free. Pages Functions share the Workers free quota.
- D1 free: 500 MB/DB, 5M reads + 100k writes/day, Time Travel 7 days.
- `db.batch()` = single transaction on D1 (no interactive transactions).
- OpenNext (`@opennextjs/cloudflare`) supports Next.js 16 on Workers;
  `@cloudflare/next-on-pages` is deprecated/archived.
- Official CI action: `cloudflare/wrangler-action@v4`
  (secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`).
- Browser Run free: 10 browser-min/day, 1 Quick Action/10s, 60s browser
  timeout; billed only on the paid tier. CPU-limit note: isolates tolerate
  infrequent >10 ms overruns (per Cloudflare limits doc) — that's the scrypt
  safety margin.
