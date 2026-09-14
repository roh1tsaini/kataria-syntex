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

**Business-app exception — parity is always in scope.** The business app is
two shells: `apps/app` (web/PWA + Electron) and `apps/android` (phone). A
feature, UI, copy, motion, or business-flow change belongs to BOTH, in the
same session (§2.3). The question picks where to start — it is never
permission to skip the mirror. Only the owner can scope a change to one
shell, in writing.

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
| `apps/android`      | Internal business app — Android shell around the `apps/app` bundle                                               | Capacitor 8 + the `apps/app` React 19/Vite bundle · shares `packages/app-core`                       |
| `apps/web`          | Public showcase website                                                                                          | Next.js + React 19 + Tailwind v4 · Vinext on Cloudflare Workers                                      |
| `packages/shared`   | Shared domain types, yarn/shade data, validation (`@kataria-syntex/shared`)                                      | TypeScript                                                                                           |
| `packages/app-core` | Shared business core for both apps: API client, zustand stores, offline/sync engine (`@kataria-syntex/app-core`) | TypeScript + React                                                                                   |
| `packages/tsconfig` | Shared TS config presets                                                                                         | —                                                                                                    |

## 2.1 Platforms

| Platform | Shell                                | Session storage                   |
| -------- | ------------------------------------ | --------------------------------- |
| Web/PWA  | Browser                              | HttpOnly cookie                   |
| Desktop  | Electron (`apps/app`)                | OS keychain via IPC + safeStorage |
| Mobile   | Capacitor 8 WebView (`apps/android`) | `@capacitor/preferences`          |

Build targets (fixed by owner): Android universal APK,
Windows x64, macOS arm64 dmg (Apple Silicon only), Linux x64 AppImage.
**iOS is skipped completely — never build or scaffold for it.**

- `packages/app-core` holds the shared business core (API client, zustand
  stores, offline/sync engine, error copy). Both apps configure it at boot
  through its `PlatformAdapter` seam. All three shells share one file —
  `apps/app/src/main/lib/platform.ts` — because the Android app runs the
  same built bundle inside a Capacitor WebView; the adapter branches on
  `detectHost()`. Platform differences live ONLY there. Never branch on
  platform elsewhere.
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

## 2.3 Web ↔ Android parity (mandatory for every business-app change)

The business app is ONE product with two shells: `apps/app` (web/PWA +
Electron) and `apps/android` (phone). **Web mobile is the source of truth** —
Android is the same product at phone scale, not a native variant. A change
that lands on one shell only is unfinished; never report it as done.

### What "same" means

- **Visual:** same structure, spacing, radii, control heights, colors, copy,
  icons, empty/loading/error states as `apps/app` at the `≤sm` breakpoint.
  `apps/app/design.md` is the contract; §4.1 maps the web mobile grammar onto
  Android.
- **Behavior:** same validation, navigation targets, confirmations, toasts
  (copy via `friendlyError`), permission gates, pagination and paging copy.
- **Data:** same fields, sorting, totals math; formatting from the shared
  home (`apps/app/src/main/ui/lib/format.ts`): en-IN grouping, weights to 3
  decimals, `DD Mon YYYY`.
- **Motion:** same presets and grammar (`apps/app/src/main/ui/lib/motion.ts`);
  enter/exit mirror, exits ~20% faster, reduced motion collapses.
- **Logic:** one home. Business logic, stores, offline/sync, error copy live
  in `packages/app-core` / `packages/shared`; platform differences live ONLY
  in the one adapter file (`apps/app/src/main/lib/platform.ts`). Never fork
  logic per shell.

### One bundle, one UI

There is no separate Android UI. `apps/android` is a Capacitor shell that
loads the built `apps/app` bundle; the Android rendering IS the web rendering
at the `≤sm` breakpoint. There is nothing to port and nothing to mirror —
parity is structural.

- A UI change is a web change. It lands on Android the moment the bundle is
  rebuilt and `cap sync` copies it. Never write a second implementation.
- The only Android-specific code is the Capacitor branch inside
  `apps/app/src/main/lib/platform.ts` (detectHost() === "android"): token
  storage, KV hydration, network/activity listeners, deep links, PDF
  share/print. Every other platform difference is a bug.
- Design values come from `apps/app/design.md` and its tokens in
  `globals.css`; there is no Android token conversion step.
- `apps/android/android/` is a Capacitor-generated Gradle project — native
  config only (manifest permissions, signing, ARM-only), never UI.

### How to execute

1. Read `design.md` and the web implementation first — web is truth.
2. Change web (`apps/app`); business-logic changes go in `packages/*` so every
   shell consumes them.
3. Anything that needs native capability gets a guarded branch in
   `apps/app/src/main/lib/platform.ts` behind `detectHost() === "android"`,
   plus the official `@capacitor/*` plugin. Nowhere else.
4. New value or pattern? Add it to `design.md` first; then code. Never invent
   an Android-only visual value.
5. Rebuild + sync: `bun run build` (apps/app) then
   `bunx cap sync android` (apps/android). CI does this; run both locally to
   verify.
6. Update docs in the same change: `design.md` (any untrue section),
   `apps/android/APP.md`, `BACKLOG.md` for anything deferred.
7. Platform limits (print, APK self-update): surface the exact gap to the
   owner. Never silently diverge, and never copy a web bug — report it and
   log it in `BACKLOG.md`.

## 2.4 Verification protocol (continuous — not a final step)

Verify while you work, and report exactly what ran. The agent that wrote the
code never certifies it.

1. **After each file/step:** `cd apps/android && bunx tsc --noEmit` (or the
   touched app's typecheck) — fix before moving on.
2. **One bundle:** the Android rendering is the web rendering at `≤sm`, so a
   UI change is verified once — in the browser at the `≤sm` breakpoint. The
   report states which viewport was checked.
3. **Independent pass:** for UI/business changes, hand the working diff to a
   separate verification agent (fresh context, no edit rights). It reads
   `git diff` plus the web references and lists mismatches/regressions; the
   author fixes, the verifier re-checks.
4. **Gates (repo root):** `bun run typecheck`, `bun run lint`,
   `bun run build`, `bun run format:check` (Windows CRLF noise is
   pre-existing — at minimum every changed file passes
   `bunx prettier --check`). Android: `cd apps/android && bunx tsc --noEmit` +
   `bunx cap sync android` (copies the built web bundle into the native
   project; CI runs `gradle assembleRelease` for the signed APK).
5. **Device checks belong to the owner:** motion feel, camera, install,
   real-pixel layout. List them as "owner-verified pending" — never claim
   them.
6. **Report shape:** files changed (file:line), exact commands + results,
   what was compared against what, unresolved/needs-owner, doc + backlog
   impact.

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

# inside apps/android (Android app — Capacitor shell over the apps/app bundle)
bun run sync         # build apps/app + cap sync android
bun run open         # open android/ in Android Studio
bun run build:apk    # cap sync + gradle assembleRelease (needs the Android SDK)
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
6. Dead code and dead files get deleted outright. Nothing lingers.
7. **Use web for latest info — always verify pricing/limits/docs via `webfetch`/`websearch` before claiming free/paid status; GCP/docs change (e.g. external IP pricing 2024-02-01). Never rely on training cutoff.**
8. **Current state only.** Every file — code and docs alike — describes what
   IS, never what was. No "previously", "no longer", "legacy", "old",
   "was moved" narration; no change history; no stale references. When
   something dies: delete the code, delete its comments, update every doc
   that mentions it — all in the same change. History lives in git, nowhere
   else.
9. **Latest deps, verified before commit.** `bun run check:updates` before
   every commit; safe lines float via `^`/`~` and the lock refreshes with
   `bun install`. Deliberate pins — never "upgrade" blindly: electron exact
   (builder hoisting), drizzle v1 RC (ahead of stable).
10. **Both shells or not done.** Every feature, UI, copy, motion, or
    business-flow change lands in `apps/app` AND `apps/android` in the same
    session (§2.3) — docs updated in the same change, verification run per
    §2.4. Only the owner can scope a change to one shell, in writing.

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
automated in `.github/workflows/pipeline.yml`.

## 5. apps/app working agreement (owner-mandated, always applies)

SPEC.md/BUILD.md are **deleted** (readable from git history only). The
code and the owner's word are the truth.

- **The owner's spoken word is the single source of truth.** If a rule
  isn't written anywhere: ask the owner, then code it.
- Ask questions ONE at a time. Fix/build ONE thing at a time.
- Owner's spoken word beats code, docs, and past decisions.
- A feature/UI request on the business app is a two-shell request (§2.3).
  Never scope one shell out on your own.
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
  sync (`cd apps/android && bunx tsc --noEmit && bunx cap sync android`) —
  CI runs `gradle assembleRelease` for the signed APK.
- A UI change is verified once in the browser at the `≤sm` breakpoint
  (§2.3–§2.4) — Android renders the same bundle; a business-logic change is
  done only when both shells consume the same `packages/*` code.
