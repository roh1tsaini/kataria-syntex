# AGENTS.md — kataria-syntex

## 0. First action every session

Before doing anything, ask the user **one** question:

> What are we working on?
>
> 1. Business app — `apps/app`
> 2. Website — `apps/web`
> 3. Something else — repo-level work or something newly added

Then work ONLY on that target until told otherwise. Never change the other
workspace "while you're in there".

## 1. Communication style (mandatory)

- Talk short. Write less — but fully.
- No filler, no apologies, no restating the task, no summaries of the obvious.
- Every sentence earns its place. Code > prose. Lists > paragraphs.
- Plain English everywhere: code, comments, copy, docs.
- **UI copy & copywriting:** Real software only — zero marketing slop, promotional fluff, or conversational padding. Explain in 1–2 lines max, direct and to the point with no overexplanation.
- **Visual choices are shown, never just described.** Whenever suggesting options or asking the owner to pick between visual variants (rings, colors, spacing, layouts), build a small standalone compare page (e.g. `apps/app/public/<topic>-compare.html` — all variants visible at once, real `:focus`/`:hover` states, dark/light toggle) and surface it via SendUserFile `render`. Delete the file once the owner decides.

## 2. Repo map

| Path                | What                                                                                                             | Stack                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `apps/app`          | Internal business app — web/PWA + Electron desktop (challans, job work, stock, packing, reports)                 | React 19 + Vite + Tailwind v4 + Zustand · Hono on Cloudflare Workers · D1 (Drizzle) · PWA + Electron |
| `apps/android`      | Internal business app — Android (same features as apps/app)                                                      | React Native 0.87 + Expo SDK 57 + expo-router + NativeWind 4 + Zustand · shares `packages/app-core`  |
| `apps/web`          | Public showcase website                                                                                          | Next.js + React 19 + Tailwind v4 · Vinext on Cloudflare Workers                                      |
| `packages/shared`   | Shared domain types, yarn/shade data, validation (`@kataria-syntex/shared`)                                      | TypeScript                                                                                           |
| `packages/app-core` | Shared business core for both apps: API client, zustand stores, offline/sync engine (`@kataria-syntex/app-core`) | TypeScript + React                                                                                   |
| `packages/tsconfig` | Shared TS config presets                                                                                         | —                                                                                                    |

## 2.1 Platforms

| Platform | Shell                                | Session storage                   |
| -------- | ------------------------------------ | --------------------------------- |
| Web/PWA  | Browser                              | HttpOnly cookie                   |
| Desktop  | Electron (`apps/app`)                | OS keychain via IPC + safeStorage |
| Mobile   | React Native + Expo (`apps/android`) | expo-secure-store (keystore)      |

Build targets (fixed by owner): Android universal APK,
Windows x64, macOS arm64 dmg (Apple Silicon only), Linux x64 AppImage.
**iOS is skipped completely — never build or scaffold for it.**

- `packages/app-core` holds the shared business core (API client, zustand
  stores, offline/sync engine, error copy). Both apps configure it at boot
  through its `PlatformAdapter` seam (web/Electron:
  `apps/app/src/main/lib/platform.ts`; Android:
  `apps/android/src/lib/core-adapter.ts`). Platform differences live ONLY in
  those two adapter files. Never branch on platform elsewhere.
- A change is "done" for apps/app only when web/PWA still works; desktop
  (Electron) must stay compiling against the same renderer bundle. Business
  logic changes must build in BOTH apps (`apps/app` + `apps/android`) —
  they share `packages/app-core`. Breaking one shell to fix another is not
  a fix.

## 2.2 Design language (mandatory for every screen, both apps)

- **`apps/app/design.md` is the design system — the single source of truth
  for the app UI.** Read it BEFORE any apps/app UI change. Apple/macOS/iOS
  consistency: one radius ladder, one control-height ladder, one spacing grid,
  one motion grammar. Never invent values it doesn't define — extend it first.
- **Living doc — always update it.** AFTER every apps/app UI change, update
  `apps/app/design.md` in the same change (new values/patterns first, then
  code; rewrite any section the change made untrue). The doc always describes
  the current state — that is how the app stays consistent.
- **Apple × Luma × shadcn/ui** — minimal, generous whitespace, soft
  borders/shadows, no visual noise. Tokens live in
  `apps/app/src/main/ui/globals.css`; extend tokens there, never fork
  per-page styles.
- shadcn/ui components + Tailwind v4 utilities only. Inter Variable, fluid
  `clamp()` typography, `oklch` accent tokens.
- Motion per design.md §5: springs from `src/main/ui/lib/motion.ts`, no
  bounce spam, exits mirror entries, respect `prefers-reduced-motion`.
  **NO spinners** — skeleton shimmer blocks only.
- Responsive first-class: mobile cards → desktop grids; 44px touch targets;
  safe-area aware; dark mode always considered.
- Professionalism bar: every screen looks like a polished product, not an
  admin demo. If a screen looks dated next to macOS System Settings, Linear
  or Luma, it's not done.

- `dead-files/` — archive for dead docs/specs/files. Reference only. Don't
  edit, don't resurrect content unless explicitly asked. Contents:
  `dead-files/FIXES.md`, `dead-files/apps/app/SPEC.md`,
  `dead-files/apps/app/BUILD.md`, `dead-files/apps/app/CLOUDFLARE.md`,
  `dead-files/apps/app/app-flow.canvas`.

## 3. Commands

```bash
# repo root (Bun workspaces + turbo) — bun is the ONLY package manager
bun install
bun run dev        # all dev servers
bun run build      # production build — required gate
bun run typecheck  # required gate
bun run lint       # required gate
bun run format:check
bun run check:updates  # registry drift review — run before every commit

# Git hooks (husky): pre-commit runs lint-staged + typecheck,
# pre-push runs lint + build. Never commit with --no-verify.

# inside apps/app
bun run dev:server   # Hono API (workerd, wrangler dev)
bun run dev          # Vite frontend on :1420
bun run electron:dev # Electron shell over the Vite dev server

# inside apps/android (Android app — React Native + Expo)
bun run start        # Metro dev server (needs `adb reverse tcp:3000 tcp:3000`
                     # for the local API, or set EXTRA_API_BASE)
bun run android      # compile + install a dev build on a connected device
bun run prebuild     # regenerate android/ from app.config.ts (CI does this)
```

## 4. Hard rules

1. **Done means:** `typecheck` + `build` pass from repo root AND the feature
   actually works when run. Nothing counts before that.
2. No template/starter code. No placeholders. Custom-crafted only.
3. Business facts and shared content live in `packages/shared/` (or content
   dirs) — never hardcoded inside components.
4. Always latest stable majors (Node, Bun, React, Next.js, Vite, TS). If an
   upgrade breaks something, fix it properly — never downgrade to escape.
5. Docs/code conflict → ask the owner. Owner's word wins, then update both.
6. Dead code gets deleted. Dead files go to `dead-files/`. Nothing lingers.
7. **Use web for latest info — always verify pricing/limits/docs via `webfetch`/`websearch` before claiming free/paid status; GCP/docs change (e.g. external IP pricing 2024-02-01). Never rely on training cutoff.**
8. **Current state only.** Every file — code and docs alike — describes what
   IS, never what was. No "previously", "no longer", "legacy", "old",
   "was moved" narration; no change history; no stale references. When
   something dies: delete the code, delete its comments, update every doc
   that mentions it — all in the same change. History lives in git and
   `dead-files/`, nowhere else.
9. **Latest deps, verified before commit.** `bun run check:updates` before
   every commit; safe lines float via `^`/`~` and the lock refreshes with
   `bun install`. Deliberate pins — never "upgrade" blindly: electron exact
   (builder hoisting), react-native (Expo SDK pairing), nitro (mmkv proven
   pair), drizzle v1 RC (ahead of stable), expo `~` (SDK pins).

## 4.0.1 Updates & versioning (owner-mandated, apps/app)

1. **No backward compatibility.** The API never keeps old paths/shapes alive
   for stale clients. When a change breaks clients: bump `version` AND
   `minAppVersion` in `apps/app/package.json` in the same change. Stale
   clients get `426 update_required` (server gate,
   `src/server/lib/version-gate.ts`) and show the blocking update dialog.
2. **Bump `version` after coding.** Whenever an AI session finishes a
   change that warrants a release, it bumps `apps/app/package.json`
   `version` (patch for fixes, minor for features) as part of that change.
   The CI push build publishes to R2 only when the version differs, so the
   bump IS the release action.
3. Releases ship from the `ks-releases` R2 bucket (`/releases/*` on the app
   Worker) — see `apps/app/APP.md` §14. Latest version only; the manifest
   is `app/android/latest.json`.

## 4.1 Decision authority (owner-mandated, overrides everything)

- **Never decide on your own. Never touch code without telling the owner
  first.** Every choice — technical, design, infra — goes to the owner as a
  question; the owner's answer is the last option, always.
- Recommendations are given ONLY when the owner asks for them, and they stay
  advice — the owner decides.
- "Audit" means investigate and REPORT back, nothing more. The owner reads
  the report and tells you what to fix. You never pick fixes yourself.
- If instructions conflict, stop and ask. Never resolve ambiguity by
  instinct.

## 4.2 Free-forever & zero-lock-in policy (owner-mandated)

Every part of this project must be:

1. **Free** — $0, forever. Not even a domain purchase. Paid tiers of any kind
   are rejected by default; if something paid exists anywhere in the stack,
   surface it to the owner immediately.
2. **Trusted & durable** — only services from companies that will realistically
   outlive the business (e.g. Google, GitHub). No startups, no niche vendors,
   nothing that can bankrupt, pivot, or sunset under us.
3. **Zero/minimal lock-in** — anything must migrate instantly off the current
   host: D1 is plain SQLite (`wrangler d1 export`), sites are static bundles,
   config is plain env vars/secrets. No proprietary data formats, no data
   trapped in someone else's cloud.
4. **Minimal footprint** — stay inside the Cloudflare free tier; every added
   external service or paid feature needs owner approval.
5. **Minimal maintenance** — boring, stable tech; few moving parts; strong
   typed codebase that doesn't need constant babysitting.

Hosting baseline: **Cloudflare free tier** (Workers + D1, free
Cloudflare hostnames). No VM, no Docker, no deSEC. Anything added on top of
that baseline requires an explicit owner question first. D1 provisioning is
automated in `.github/workflows/cf-deploy.yml`.

## 5. apps/app working agreement (owner-mandated, always applies)

SPEC.md/BUILD.md are **archived** in `dead-files/apps/app/`
(frozen — don't edit, don't tick). The code and the owner's word are the
truth.

- **The owner's spoken word is the single source of truth.** If a rule
  isn't written anywhere: ask the owner, then code it.
- Ask questions ONE at a time. Fix/build ONE thing at a time.
- Owner's spoken word beats code, docs, and past decisions.
- No shortcuts, no placeholders, no template code. Best practices + latest
  stable tech. Hard work over hacks.
- Dead code dies instantly. Old code is reference until a feature matches
  what the owner asked for; then delete what's replaced.
- NEVER read, open, or ask permission for any `.env*` file. Env secrets are
  owner-only territory — ask the owner to set values themselves; never echo,
  copy, or commit env contents.
- NEVER commit, push, amend, or create PRs unless explicitly asked.

## 6. Coding best practices (mandatory, both apps)

**Types & data**

- Strict TS. No `any`, no non-null `!` shortcuts — model data precisely;
  `unknown` + narrowing at system boundaries (fetch responses, IPC, storage).
- One source of truth per type: shared domain types live in
  `packages/shared`; UI derives from store/API types, never re-declares.

**Validation & security**

- Validate every external input at the boundary — zod schema on each route
  body/query; normalize identifiers/phones before touching the DB.
- Rate-limit anything expensive or paid (SMS/email sends, code claims);
  one-time codes are single-use via CAS updates with TTLs; compare secrets
  timing-safely; dummy-hash when a user doesn't exist to avoid user
  enumeration via timing.
- Secrets only ever enter through env vars read at use site. Never log them,
  never echo them, never hardcode fallbacks that look like credentials.

**Server (Hono + Drizzle)**

- Routes stay thin: parse → call an `auth/` or `lib/` module → shape JSON.
  Business logic lives in modules, testable without HTTP.
- Drizzle query builder only — no concatenated SQL strings. Multi-statement
  invariants run inside a transaction using the sync `.run()` pattern
  (SQLite driver commits async callbacks outside the tx).
- Errors are machine codes: `{ error: "snake_case_code" }`. Frontend maps
  codes → human copy in ONE file (`ui/lib/errors.ts`). Stack traces never
  reach responses outside dev.

**React / frontend**

- Components small and single-purpose. Local state stays local; cross-page
  state only in zustand stores; derive values, don't cache copies.
- Route-level code splitting (`React.lazy`) — keep the entry bundle lean.
- Handle every promise: user-visible failures show inline errors or toasts;
  loading states are skeletons, never spinners; optimistic updates only with
  a queue/sync story behind them.
- Accessibility is not optional: labelled inputs, 44px targets, visible
  focus, `aria-invalid` on errors, reduced-motion respected.

**Caching (mandatory, both apps)**

- Every cache states its invalidation story in the same change — TTL,
  version key, or explicit wipe event. A cache with no story doesn't ship.
- HTTP: content-hashed URLs may be `immutable`; everything else (HTML, SW
  scripts, manifests) is revalidated (`max-age=0, must-revalidate`) or
  short-TTL. API responses are always `no-store`. apps/app's concrete
  policy lives in `apps/app/APP.md` §14.2.
- Client caches (module-level, store, SW runtime) are keyed by account/
  workspace and wiped on logout/401/account switch (`lib/data-caches.ts` in
  apps/app). Stale-while-revalidate UIs must still refetch on mount.
- The service worker never force-reloads a tab and never caches `/api/*`;
  updates apply through the update banner / blocking dialog only.

**Style**

- Plain English names; kebab-case files, PascalCase types/components.
- Comments explain WHY, never WHAT; deleted code deletes its comments too.
- Prettier owns formatting — never hand-format; eslint must pass clean, no
  blanket disables (a targeted disable needs a reason comment).

**Definition of done (per PR/session)**

- `bun run typecheck && bun run lint && bun run format:check && bun run
build` all green from repo root, AND the feature verified by actually
  running it. The web renderer (web/PWA + Electron) must still compile as
  one bundle, and the Android app (apps/android) must still typecheck and
  Metro-bundle (`bunx expo export -p android`) — CI builds the signed APK.
