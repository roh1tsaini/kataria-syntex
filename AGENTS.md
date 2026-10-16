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
one bundle in three shells: `apps/app` (web + Electron) and `apps/android`
(a Capacitor 8 WebView that renders that same built bundle at the `≤sm`
breakpoint). There is no separate Android UI, so a feature, UI, copy, motion,
or business-flow change lands on every shell by landing on the web bundle
(Section 2.3). The question picks where to start — it is never permission to fork.
Only the owner can scope a change to one shell, in writing.

## 1. Communication style (mandatory)

- Talk short. Write less — but fully.
- No filler, no apologies, no restating the task, no summaries of the obvious.
- Every sentence earns its place. Code > prose. Lists > paragraphs.
- Plain English everywhere: code, comments, copy, docs.
- **No section sign.** Never write U+00A7 — in chat, docs, code, comments, or filenames. Cross-reference as `Section 2.4` or `spec.md` Section 5.1. The `U+00A7 2.4` shorthand form is a training-data habit, not a repo convention.
- **UI copy & copywriting:** Real software only — zero marketing slop, promotional fluff, or conversational padding. Explain in 1–2 lines max, direct and to the point with no overexplanation.
- **Visual choices are shown, never just described.** Whenever suggesting options or asking the owner to pick between visual variants (rings, colors, spacing, layouts), build a small standalone compare page (e.g. `apps/app/design-compare/<topic>-compare.html` — all variants visible at once, real `:focus`/`:hover` states, dark/light toggle) and surface it via SendUserFile `render`. Delete the file once the owner decides.

## 1.1 Doc rules (mandatory — every doc, every workspace)

Owner-mandated format. The docs are the product's memory: fresh,
well-organized, short, and true.

- **Short bullets, short sentences. No paragraphs.** One idea per bullet.
- **Topic headings in bold follow one shape:** `**Topic**` then bullets.
  Tables allowed where they beat bullets.
- **One fact, one file.** A fact never appears twice — the other file links
  to the owner instead of repeating it.
- **Minimal file count.** Merge small topics into the file that owns the
  area. A new file needs owner approval first.
- **Living docs, current state only.** Updated in the same change as the
  code. No history, no "was/previously/legacy" (Section 4, rule 8).
- **Every number is exact.** TTLs, limits, versions — no "about", no "~".
- **Plan before writing.** Business rules and flows are decided with the
  owner first, then written. No placeholders, no guesses.
- Language is plain English a non-engineer can read. Example shape:

  ```md
  **Auth**

  - Android: email + phone
  - Web/Electron: email + phone + QR
  - Limits: 5 attempts per IP
  - DB: `users`, `sessions`
  - Login logs kept 30 days
  - QR valid 10 min · OTP valid 5 min
  ```

## 1.2 Reply format (mandatory — every chat reply)

Owner-mandated. Written for an ADHD reader: answer first, one idea
per line, nothing to hunt for.

**Answer first**

- Line 1 is the verdict, the result, or the action. Never a preamble.
- No "Great question", no "let me check", no restating the task.
- The why goes after the claim, and only when it changes the decision.

**Shape**

- One idea per line, max 80 characters. Never stack two ideas on one.
- Three things or more = a list. Two things = two lines.
- Bullets, never paragraphs. Nest one level, never two.
- Bold the one load-bearing word, not the whole sentence.
- A table only when comparing across columns beats comparing down bullets.

**Length**

- Default 5 lines or fewer.
- Longer = headed list, one idea per bullet, so the eye can jump.
- List caps at 7 items. Past that, group under a sub-label.

**Asking**

- One question per turn, as a labeled `Ask:` line with 2–4 options.
- Each option states its trade-off in under 12 words.
- Never bundle questions into one turn.

**Reporting**

- Lead with the result: passed, failed, what changed.
- Show the failing line, not a description of the failure.
- File changes as `path:line`, one per bullet.
- End with the single next action, as one command. Never "let me know if".

**Never**

- A caveat before the claim.
- Progress theater: "working on it", "almost done".
- Reflecting the request back, except as an `Ask:` line.
- Asking approval for something already asked for.
- Hedging: "I think", "perhaps", "it seems". State it, or say you are unsure.

**When something broke**

- Line 1 says it broke. Then why. Then what is next.
- Never bury a failure under what went right.

## 2. Repo map

Workspace layout and per-workspace stack: `README.md`. Session storage per
shell and the owner-fixed build targets: `apps/app/spec.md` Section 5.

## 2.1 Platforms

- **iOS is skipped completely — never build or scaffold for it.**
- `packages/app-core` holds the shared business core (API client, zustand
  stores, network reachability, error copy). Both apps configure it at boot
  through its `PlatformAdapter` seam. All three shells share one file —
  `apps/app/src/main/lib/platform.ts` — because the Android app runs the
  same built bundle inside a Capacitor WebView; the adapter branches on
  `detectHost()`. Platform differences live ONLY there. Never branch on
  platform elsewhere.
- A change is "done" for apps/app only when web still works; desktop
  (Electron) must stay compiling against the same renderer bundle. Business
  logic changes must build in `apps/app` + `apps/android` — Android consumes
  them through the `apps/app` bundle it renders, so one `packages/*` edit
  reaches every shell. Breaking one shell to fix another is not a fix.

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
- Motion per design.md Section 5: springs from `src/main/ui/lib/motion.ts`, no
  bounce spam, exits mirror entries, respect `prefers-reduced-motion`.
  **NO spinners** — skeleton shimmer blocks only.
- Responsive first-class: mobile cards → desktop grids; 44px touch targets;
  safe-area aware; dark mode always considered.
- Professionalism bar: every screen looks like a polished product, not an
  admin demo. If a screen looks dated next to macOS System Settings, Linear
  or Luma, it's not done.

## 2.3 Web ↔ Android parity (mandatory for every business-app change)

**One bundle, one UI.** The business app is ONE product: `apps/app` is a
React 19 + Vite SPA served as web, wrapped by Electron (desktop), and
wrapped by `apps/android` — a Capacitor 8 WebView that renders the same built
bundle at the `≤sm` breakpoint. **There is no separate Android UI, nothing to
port, nothing to mirror — parity is structural.** A UI change is a web
change; it lands on Android the moment the bundle is rebuilt and `cap sync`
copies it. Never write a second implementation.

### What "same" means

Rules only — the values live in one place each:

- **Visual** — contract in `apps/app/design.md`; tokens in `globals.css`, no
  Android token-conversion step. Phone-scale contract in `design.md` Section 4.1.
- **Behavior** — same validation, navigation targets, confirmations, toasts
  (copy via `friendlyError`); per-shell detail in `apps/app/spec.md` Section 5.1.
- **Data** — same fields and sorting; date/number formatting is owned by
  `apps/app/design.md` Section 2.4.1.
- **Motion** — presets in `apps/app/src/main/ui/lib/motion.ts`, grammar in
  `design.md` Section 5.
- **Logic** — one home: `packages/app-core` / `packages/shared`.
  Platform differences live ONLY in the one adapter file
  (`apps/app/src/main/lib/platform.ts`), behind `detectHost() === "android"`.
  A platform branch anywhere else is a bug.

### How to execute

1. Read `design.md` and the web implementation first — the bundle is truth.
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
6. Update docs in the same change: `design.md` (any untrue section) and
   `apps/app/spec.md` Section 5.1 (per-platform behaviour).
7. Platform limits (APK self-update): surface the exact gap to the
   owner. Never silently diverge, and never copy a web bug — report it to the
   owner.

## 2.4 Verification protocol (continuous — not a final step)

Verify while you work, and report exactly what ran. The agent that wrote the
code never certifies it.

1. **After each file/step:** `cd apps/android && bunx tsc --noEmit` (or the
   touched app's typecheck) — fix before moving on.
2. **One bundle:** the Android rendering is the web rendering at the `≤sm`
   breakpoint, so a UI change is verified once — in the browser at the `≤sm`
   breakpoint. The report states which viewport was checked. A business-logic
   change is done only when every shell consumes the same `packages/*` code.
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

Every script in the repo, by workspace.

```bash
# repo root (Bun workspaces + turbo) — bun is the ONLY package manager
bun install
bun run dev            # all dev servers (turbo dev)
bun run dev:web        # website only
bun run dev:app        # business app only
bun run build          # production build — required gate
bun run build:web      # website build only
bun run build:app      # business app build only
bun run typecheck      # required gate
bun run lint           # required gate
bun run format         # prettier --write .
bun run format:check   # required gate
bun run check:updates  # registry drift review (bun outdated) — before every commit
bun run prepare        # husky install (git hooks)

# Git hooks (husky): pre-commit runs lint-staged + typecheck,
# pre-push runs lint + build. Never commit with --no-verify.

# inside apps/app
bun run dev               # Vite frontend on :1420 (strict port, proxies /api → :3000)
bun run dev:server        # Hono API (workerd, wrangler dev) on :3000
bun run electron:dev      # Electron shell over the Vite dev server
bun run electron:package  # build + build:electron + electron-builder
bun run build:electron    # bundle main/preload for Electron
bun run build             # vite build (renderer)
bun run typecheck         # tsc for app, server and electron configs
bun run lint              # eslint .
bun run db:generate       # drizzle-kit generate (new migration)
bun run db:migrate:local
bun run icons             # regenerate app icons (sharp)

# inside apps/web
bun run dev        # vinext dev on :3000
bun run build      # vinext build
bun run typecheck  # wrangler types + tsc --noEmit
bun run lint       # eslint .

# inside apps/android (Android app — Capacitor shell over the apps/app bundle)
bun run build:web:apk # build apps/app with the APK build script
bun run build:web     # plain vite build of apps/app
bun run sync      # build apps/app + cap sync android
bun run open      # open android/ in Android Studio
bun run build:apk # cap sync + gradlew assembleRelease (Android SDK required;
                  # see apps/app/spec.md Section 5.2)
bun run typecheck # bunx tsc --noEmit
bun run lint      # eslint .
```

## 4. Hard rules

1. **Done means:** `typecheck` + `build` pass from repo root AND the feature
   actually works when run. Nothing counts before that.
2. No template/starter code. No placeholders. Custom-crafted only.
   **Business rules are planned with the owner first, then written, then
   coded** — never guessed. A doc line without an owner decision behind it
   is a bug (Section 1.1).
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
10. **One bundle, three shells.** The business app is one SPA bundle rendered
    by web, Electron and the `apps/android` WebView — there is no separate
    Android UI, so every feature, UI, copy, motion, or business-flow change
    lands on every shell by landing on the web bundle (Section 2.3). Docs updated in
    the same change, verification run per Section 2.4. Only the owner can scope a
    change to one shell, in writing.
11. **Docs follow Section 1.1.** Short bullets, one fact in one file,
    minimal file count, exact numbers, current state only. A doc out of
    shape is a bug — fix it in the same change that touched the topic.
    Rewriting a doc means the old version dies: no old file left behind,
    no duplicate copy — git history is the archive.

## 4.0.1 Updates & versioning (owner-mandated, apps/app)

1. **No backward compatibility.** The API never keeps old paths/shapes alive
   for stale clients. When a change breaks clients: bump `version` AND
   `minAppVersion` in `apps/app/package.json` in the same change. Stale
   clients get `426 update_required` (server gate,
   `src/server/lib/version-gate.ts`) and show the blocking update dialog.
2. **Bump `version` after coding.** Whenever an AI session finishes a
   change that warrants a release, it bumps `apps/app/package.json`
   `version` (patch for fixes, minor for features) as part of that change.
   Why the bump is the release action: `apps/app/spec.md` Section 12.
3. Releases ship from the `ks-releases` R2 bucket (`/releases/*` on the app
   Worker) — see `apps/app/spec.md` Section 12. Latest version only; the manifest
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

The business is written in `apps/app/spec.md` (screens, fields, data) and
`apps/app/rules.md` (logic, calculations, numbering). The owner's word beats
both.

- **The owner's spoken word is the single source of truth.** If a rule
  isn't written anywhere: ask the owner, then code it.
- Ask questions ONE at a time. Fix/build ONE thing at a time.
- Owner's spoken word beats code, docs, and past decisions.
- **Plan first, code later.** The business and its edge cases are described
  by the owner, written into the docs, then coded. Nothing is coded from an
  unwritten rule.
- **Docs are maintained continuously — like code.** Every session that
  changes behavior updates the owning file in the same change.
  Owner files: `apps/app/spec.md` (business screens, fields, data, and
  tech: DB, API, auth) · `apps/app/rules.md` (business logic) ·
  `apps/app/design.md` (UI) · `DEPLOY.md` (ops) · `AGENTS.md` (this
  file). One fact lives in exactly one of them (Section 1.1).
- A feature/UI request on the business app is a one-bundle request — it
  reaches every shell (Section 2.3). Never scope one shell out on your own.
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
  codes → human copy in ONE file (`packages/app-core/src/errors.ts`). Stack
  traces never reach responses outside dev.

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
  policy lives in `apps/app/spec.md` Section 13.
- Client caches (module-level, store, runtime) are keyed by account
  and wiped on logout/401/account switch
  (`packages/app-core/src/data-caches.ts`). Stale-while-revalidate UIs must
  still refetch on mount.
- There is no service worker. A deploy reaches a tab on its next navigation
  through revalidated HTML; a blocking dialog is reserved for a required version
  floor.
- **Routine updates are background work, with no surface.** Browser and
  Windows/Linux deploys apply on the next navigation (desktop installs on
  quit); Android manifest checks stay silent and expose the APK action in
  Settings, with one system notification per release pointing at it; only the
  macOS dmg prompt announces. Only a server `426
update_required` floor may block work. Keep HTML revalidated,
  cache only content-hashed assets as immutable, and never make users clear
  browser data to receive a normal release.
- **A stale chunk is a reload, not an error.** Route chunks are hashed, so a
  tab open across a deploy can request a chunk URL that no longer exists —
  reload once (`lib/lazy-route.ts`), then let the ErrorBoundary take a second
  failure.
- **Native shells carry their own cache invalidation.** Electron's `app://`
  handler sets cache headers explicitly (custom protocols are cached against
  the URL otherwise); Android compares the native versionName with the
  executing bundle at boot (`reloadOnStaleAndroidBundle`).

**Style**

- Plain English names; kebab-case files, PascalCase types/components.
- Comments explain WHY, never WHAT; deleted code deletes its comments too.
- Prettier owns formatting — never hand-format; eslint must pass clean, no
  blanket disables (a targeted disable needs a reason comment).

**Definition of done (per PR/session)**

- `bun run typecheck && bun run lint && bun run format:check && bun run build`
  all green from repo root, AND the feature verified by actually running it.
  The web renderer (web + Electron) must still compile as
  one bundle, and the Android app (apps/android) must still typecheck and
  sync (`cd apps/android && bunx tsc --noEmit && bunx cap sync android`) —
  CI runs `gradle assembleRelease` for the signed APK.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
