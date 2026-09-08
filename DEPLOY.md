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

Native shells build via `.github/workflows/app-build.yml` (manual dispatch
or pushes touching `apps/app/**` / `apps/android/**`): Electron desktop from
the `apps/app` renderer, and the React Native Android app (`apps/android`)
as its own Metro bundle.

## First-time setup (once)

### 1. Connect Cloudflare to GitHub

Add two secrets (repo → Settings → Secrets and variables → Actions):

| Secret                  | Value                                            |
| ----------------------- | ------------------------------------------------ |
| `CLOUDFLARE_API_TOKEN`  | Token with **D1 Edit + Workers Edit**            |
| `CLOUDFLARE_ACCOUNT_ID` | Your account id (Cloudflare dashboard → Workers) |

The deploy workflow (`cf-deploy.yml`) **auto-provisions both D1 databases and
injects their ids on the runner** — no manual dashboard steps, no ids to paste.

### 2. Set the app origin

Add a repository **variable** `APP_URL` = the app worker FQDN
(`https://app.katariasyntex.workers.dev`). Native builds read it: the
Electron build injects it into the packaged bundle; the Android APK bakes
it as `EXTRA_API_BASE`.

### 3. Deploy

Push to `main`. On every push:

1. `app-build.yml` — typecheck on every change; full native builds (3 desktop
   targets + APK) on pushes to `main` touching `apps/app` or `apps/android`,
   or on manual dispatch.
2. `cf-deploy.yml` — website: build → ensure D1 → migrate → deploy Worker;
   app: build SPA → ensure D1 → migrate → deploy Worker.

After the first app deploy, set `APP_URL` (step 2) so native builds can reach
the API.

### 4. Production secrets (business app only)

The OTP sender needs real credentials in production:

```bash
cd apps/app
bunx wrangler secret put PINGRAM_API_KEY
```

Local dev reads the same keys from `apps/app/.dev.vars` (gitignored — never
commit it).

### 5. Android signing (once — before the first APK build)

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
`apps/android/android/keystore.properties`, and the config plugin
`apps/android/plugins/with-signing.ts` wires that file into the release
build — `assembleRelease` then outputs a signed APK. Keep the original
`.p12` and its password somewhere durable outside GitHub.

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

### Versioning (one source of truth)

The app version lives only in `apps/app/package.json`. Everything reads it:

- **Electron** — installers are stamped with it by electron-builder.
- **Android** — `apps/android/app.config.ts` reads the same file:
  `versionName` = the version, `versionCode` =
  `major*10000 + minor*100 + patch` (0.6.0 → 600). Every bump raises the
  code — Android rejects updates that don't.
- **App UI** — Settings → About shows it (injected at build time).
- **Releases** — the `v<version>` GitHub Release tag is read from the file.

One bump releases everywhere: desktop installers and the Android APK ride
the same version.

### Releases (desktop/Android)

Bump `apps/app/package.json`, push, then Repo → Actions → **Build KS Biz App**
→ Run workflow:

- `targets: all | desktop | android` — desktop-only skips the 90-min APK job.
- The release job tags `v<version>` from `apps/app/package.json` and attaches
  the `.exe` / `.dmg` / `.AppImage` / `.apk` files. Re-releasing a version
  whose tag already exists fails the run — bump first.

Android signing uses the secrets from first-time setup step 5 — the APK job
fails fast when they are absent. The APK job runs `bunx expo prebuild -p
android --no-install` (generates the native project — it is not committed)
before gradle; the signing config comes from the config plugin.

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

Web/PWA and Electron compile against one renderer bundle (`apps/app`); the
Android app typechecks and Metro-bundles separately
(`bunx tsc --noEmit` + `bunx expo export -p android` inside `apps/android`).
