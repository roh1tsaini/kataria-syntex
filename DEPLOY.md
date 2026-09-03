# Deployment & Maintenance Guide

Everything needed to set up, deploy, and maintain this monorepo on GitHub +
Cloudflare — free tier only.

## Stack overview

| Piece        | Where it runs                          | Notes                                |
| ------------ | -------------------------------------- | ------------------------------------ |
| Website      | Cloudflare **Workers** (Vinext)        | `apps/web`, D1 for inquiries         |
| Business app | Cloudflare **Pages** (SPA + Functions) | `apps/app`, D1 for business data     |
| Databases    | Cloudflare **D1** (SQLite)             | `kataria-app`, `kataria-web-inquiry` |
| CI/CD        | GitHub Actions                         | auto-deploys on push to `main`       |

Native shells (Electron desktop, Capacitor Android) build from the same
renderer via `.github/workflows/app-build.yml` (manual dispatch or
`apps/app/**` changes).

## First-time setup (once)

### 1. Connect Cloudflare to GitHub

Add two secrets (repo → Settings → Secrets and variables → Actions):

| Secret                  | Value                                              |
| ----------------------- | -------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Token with **D1 Edit + Pages Edit + Workers Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | Your account id (Cloudflare dashboard → Workers)   |

The deploy workflow (`cf-deploy.yml`) **auto-provisions both D1 databases and
injects their ids on the runner** — no manual dashboard steps, no ids to paste.

### 2. Set the app origin

Add a repository **variable** `APP_URL` = the Pages app FQDN (e.g.
`https://kataria-app.pages.dev`). Native builds and the APK CSP injection read
it.

### 3. Deploy

Push to `main`. On every push:

1. `app-build.yml` — typecheck on every change; full native builds (3 desktop
   targets + APK) on pushes to `main` touching `apps/app`, or on manual
   dispatch.
2. `cf-deploy.yml` — website: build → ensure D1 → migrate → deploy Worker;
   app: build SPA → ensure D1 → migrate → deploy Pages.

After the first app deploy, set `APP_URL` (step 2) so native builds can reach
the API.

### 4. Production secrets (business app only)

The OTP sender needs real credentials in production:

```bash
cd apps/app
bunx wrangler pages secret put PINGRAM_API_KEY --project-name kataria-app
bunx wrangler pages secret put PINGRAM_FROM --project-name kataria-app
bunx wrangler pages secret put PINGRAM_BASE_URL --project-name kataria-app
```

Local dev reads the same keys from `apps/app/.dev.vars` (gitignored — never
commit it).

## Day-to-day maintenance

### Database changes

1. Edit `apps/app/src/server/db/schema.ts`.
2. `bun run db:generate` (inside `apps/app`) → review the generated migration.
3. Push. CI applies migrations before deploying.

Local: `bun run db:migrate:local`. Inspect: `bunx wrangler d1 execute kataria-app --local --command "..."`.

### Backups (zero-lock-in)

D1 is plain SQLite — export any time:

```bash
bunx wrangler d1 export kataria-app --output backup-app.sql
bunx wrangler d1 export kataria-web-inquiry --output backup-web.sql
```

Keep exports somewhere durable (GitHub private repo, Google Drive).

### Releases (desktop/Android)

Repo → Actions → **Build Challan App** → Run workflow:

- `targets: all | desktop | android` — desktop-only skips the 90-min APK job.
- Optional `version` → creates a `v<version>` GitHub Release with the
  `.exe` / `.dmg` / `.AppImage` / `.apk` files attached.

Android signing needs the `ANDROID_KEY_BASE64/ALIAS/PASSWORD` secrets (PKCS#12
keystore, base64-encoded).

### Monitoring

- Cloudflare dashboard → Workers & Pages → per-app logs/metrics (free tier).
- GitHub Actions tab for build/deploy failures.
- `GET /api/health` on the app for a quick liveness check.

### Upgrades

- Keep majors current: `bun install` after bumping any dep; the repo gates
  (`typecheck` + `lint` + `build`) will catch breakage.
- Wrangler: `bunx wrangler --version` vs `package.json`; changelog before major
  bumps.

## Local development

```bash
bun install
bun run dev:web    # website on :3000 (vinext)
bun run dev:app    # app: vite on :1420 + API on :3000 (pinned)
```

`apps/app` extras: `bun run dev` (frontend only), `bun run dev:server` (API
only), `bun run electron:dev`.

## Required gates (every change)

```bash
bun run typecheck && bun run lint && bun run format:check && bun run build
```

All three app shells (web/PWA, Electron, Capacitor) must still compile against
the same renderer bundle.
