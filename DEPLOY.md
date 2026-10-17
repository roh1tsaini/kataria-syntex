# Deployment & Maintenance Guide

Everything needed to set up, deploy, and maintain this monorepo on GitHub +
Cloudflare — free tier only.

## Stack overview

| Piece        | Where it runs                      | Notes                            |
| ------------ | ---------------------------------- | -------------------------------- |
| Website      | Cloudflare **Workers** (Vinext)    | `apps/web`, D1 for inquiries     |
| Business app | Cloudflare **Workers** (SPA + API) | `apps/app`, D1 for business data |
| Databases    | Cloudflare **D1** (SQLite)         | `ks-biz-app-db`, `ks-web-db`     |
| CI/CD        | GitHub Actions                     | auto-deploys on push to `main`   |

Worker bindings, hostnames and the release bucket: `apps/app/spec.md`
Section 11. Database and bucket names repeat here on purpose — the commands in
this guide type them.

## First-time setup (once)

### 1. Connect Cloudflare to GitHub

Add two secrets (repo → Settings → Secrets and variables → Actions):

| Secret                  | Value                                                           |
| ----------------------- | --------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Token with **D1 Edit + Workers Edit + Workers R2 Storage Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | Your account id (Cloudflare dashboard → Workers)                |

The deploy jobs (`deploy-web` and `deploy-app` in `pipeline.yml`)
**auto-provision both D1 databases and inject their ids on the runner** — no
manual dashboard steps, no ids to paste.

### 2. Set the origins

Add a repository **variable** `APP_URL` = the app worker FQDN
(`https://app.katariasyntex.workers.dev`; a bare FQDN is also accepted).
Native builds read it: the
Electron build injects it into the packaged bundle; the Android APK bakes
it as `VITE_API_URL` (a bare FQDN is normalized to https). For Android, the
same value becomes the bare host the deep-link filter and the installer
plugin's download-origin check accept — the pipeline strips the scheme
before passing it to Gradle, and the build fails if `APP_HOST` is not a
bare hostname (so a poisoned variable can never produce an un-updatable
APK).

### 3. Configure the Telegram bot

Create a bot with BotFather, then add these repository secrets and variable
under Settings → Secrets and variables → Actions:

| Name                      | Type     | Value                                                           |
| ------------------------- | -------- | --------------------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`      | Secret   | Token from BotFather                                            |
| `TELEGRAM_WEBHOOK_SECRET` | Secret   | Random 1–256 character value using letters, numbers, `_` or `-` |
| `TELEGRAM_ADMIN_ID`       | Variable | Your numeric Telegram user ID                                   |

The app deploy stores the two secrets in the Worker, deploys the Worker, then
registers `<APP_URL>/api/telegram/webhook`. The deploy fails if configuration
or webhook registration fails. Send `/start` to the bot from the owner account
after creating it so it can send OTP copies.

### 4. Deploy

Push to `main`. One workflow (`pipeline.yml`) runs everything:

1. `gate` — typecheck + lint + format + build via Turbo — resolves whether
   the push introduces a new release version and uploads the shared
   `apps/app` renderer for later jobs. `prune-artifacts` deletes artifacts
   from completed Pipeline runs in parallel (skipped on PRs, which upload
   no artifacts).
2. `deploy-web` — runs immediately in parallel on push: ensure website D1
   (`ks-web-db`) → migrate → build Vinext → deploy website worker.
3. `desktop` + `android` — download the shared renderer, then create the
   Windows and Linux installers (x64 + arm64, one CI job per CPU target; the
   Linux arm64 job runs on GitHub's free arm64 runner for public repos), the
   macOS Apple Silicon dmg, and the signed APK. Runs on release pushes
   and manual dispatches (skipped on routine non-release commits and PRs).
4. `publish-r2` — ensures `ks-releases` bucket exists, uploads installers,
   generates one `app/android/latest.json` release-info file and derives the
   Windows/Linux Electron feeds from it. Keeps only the current release.
5. `deploy-app` — download the shared renderer → ensure D1 (`ks-biz-app-db`) →
   migrate → deploy Worker. Release pushes and manual all-target runs deploy
   after `publish-r2` so clients never hit a version floor before the release is live.
6. `cleanup-artifacts` deletes this run's GitHub Actions artifacts after all
   jobs finish. Artifacts only hand files between jobs; published releases live
   in R2. One-day artifact retention is a fallback if cleanup cannot run.

Manual dispatch (Actions → Pipeline) can rebuild only `desktop` or only
`android` via the `targets` choice. `targets: all` is limited to `main` and also
deploys the app Worker after R2 publication. Manual runs wait behind an active
push; a newer push cancels an older manual run. Manual build artifacts are
deleted when the run finishes.

After the first app deploy, set `APP_URL` (step 2) so native builds can reach
the API.

### 5. Production secrets (business app only)

The OTP sender needs real credentials in production:

```bash
cd apps/app
bunx wrangler secret put PINGRAM_API_KEY
```

Local dev reads the same keys from `apps/app/.dev.vars` (gitignored — never
commit it).

### 6. Android signing (once — before the first APK build)

The release APK must be signed, and every future update must carry the same
signature — create the keystore once and never lose it. A lost key means the
app must be uninstalled and reinstalled on every device. Existing installs
keep updating over the top as long as the signature never changes
(`com.katariasyntex.bizapp`).

```bash
# keytool ships with the JDK
keytool -genkeypair -v -keystore kataria-release.p12 -storetype PKCS12 \
  -keyalg RSA -keysize 2048 -validity 10000 -alias kataria
base64 -w0 kataria-release.p12 > kataria-release.b64   # Git Bash on Windows
```

Add three repository secrets (Settings → Secrets and variables → Actions):

| Secret                 | Value                                        |
| ---------------------- | -------------------------------------------- |
| `ANDROID_KEY_BASE64`   | contents of `kataria-release.b64` (one line) |
| `ANDROID_KEY_ALIAS`    | the alias chosen above (e.g. `kataria`)      |
| `ANDROID_KEY_PASSWORD` | the keystore password                        |

The APK job decodes the keystore on the runner, writes
`apps/android/android/keystore.properties`, and
`apps/android/android/app/build.gradle` reads it (`storeFile`,
`storePassword`, `keyAlias`, `keyPassword`) when it defines the release
`signingConfig` — `assembleRelease` then outputs a signed APK. Keep the
original `.p12` and its password somewhere durable outside GitHub.

## Day-to-day maintenance

### Database changes

1. Edit `apps/app/src/server/db/schema.ts`.
2. `bun run db:generate` (inside `apps/app`) → review the generated migration.
3. Push. CI applies migrations before deploying.

Local: `bun run db:migrate:local`. Inspect: `bunx wrangler d1 execute ks-biz-app-db --local --command "..."`.

### Backups (zero-lock-in)

D1 is plain SQLite — export any time:

```bash
bunx wrangler d1 export ks-biz-app-db --output backup-app.sql
bunx wrangler d1 export ks-web-db --output backup-web.sql
```

Keep exports somewhere durable (GitHub private repo, Google Drive).

### Releases (desktop/Android)

Bump `version` in `apps/app/package.json`, push, then Repo → Actions →
**Pipeline** → Run workflow:

- `targets: all | desktop | android` — desktop-only skips the 90-min APK job.
- Push or dispatch on `main` with `targets: all` uploads the `.exe` / `.dmg` /
  `.AppImage` / `.apk` files and publishes release info plus Electron feeds to
  R2. The app Worker deploy follows successful publication. Re-releasing
  requires a new `version`.

Android signing uses the secrets from first-time setup step 6 — the APK job
fails fast when they are absent. The APK job downloads the `apps/app`
renderer (the shared artifact built by the gate with `VITE_API_URL`), runs
`bunx cap sync android` from `apps/android`, then gradle; the signing config
is read from `apps/android/android/keystore.properties` written by CI.

Version floor, `versionCode` and manifest fields: `apps/app/spec.md` Section 12.

### Monitoring

- Cloudflare dashboard → Workers & Pages → per-app logs/metrics (free tier).
- GitHub Actions tab for build/deploy failures.
- `GET /api/health` on the app for a quick liveness check.

### Upgrades

- Keep majors current: `bun install` after bumping any dep; the repo gates
  (`AGENTS.md` Section 2.4) will catch breakage.
- Wrangler: `bunx wrangler --version` vs `package.json`; changelog before major
  bumps.
