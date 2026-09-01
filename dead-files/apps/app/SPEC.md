# SPEC — kataria-syntex app

> Living doc. Always reflects how the app SHOULD be, current state.
> Point-wise. No changelogs, no history. Owner's word wins.
> Build progress tracked in `apps/app/BUILD.md`.

## Business

Yarn trading + dyeing via job work.

Flow: **purchase yarn → job work out (dyeing) → job work back → packing → sales challan**

- Raw yarn arrives in big rolls, grey/white.
- Rolls are cut into cones in-house (machine) — **this split is NOT tracked**.
- Grey cones go to job workers for dyeing, come back dyed.
- Dyed yarn is packed, then sold via sales challan.

## Material identity & units

- A yarn = **denier** (+ **shade/color** once dyed).
- Counted in **kg** and **cones** everywhere.
- Sacks counted on job-work movement.
- No lot/batch tracking beyond optional lot no. on purchase.

## Modules & rules

### 1. Raw material purchase (stock-in)

| Field                | Required | Notes                                                                            |
| -------------------- | -------- | -------------------------------------------------------------------------------- |
| date                 | yes      | auto today, editable                                                             |
| denier               | yes      | pick from master                                                                 |
| colour               | yes      | pick from master                                                                 |
| net kg               | yes      |                                                                                  |
| supplier             | no       |                                                                                  |
| supplier challan no. | no       | supplier's paper reference                                                       |
| cones                | no       |                                                                                  |
| packing              | no       | unit toggle **Bags \| Boxes** + count; default Bags; reused on job-work challans |
| box no.              | no       | typed manually here; AUTO-INCREMENT numbering belongs to sales challan, not here |
| gross wt             | no       | drives net auto-calc                                                             |
| tare wt              | no       | drives net auto-calc                                                             |
| lot no.              | no       |                                                                                  |

Rule: net kg auto-fills as gross − tare when both present; stays manually editable; manual net alone is fine.

### 2. Job work outward challan (yarn sent for dyeing)

| Field      | Required | Notes                        |
| ---------- | -------- | ---------------------------- |
| date       | yes      |                              |
| job worker | yes      | pick from master, inline add |
| denier     | yes      | pick from master             |
| sacks      | yes      |                              |
| net kg     | yes      |                              |
| cones      | yes      |                              |

No shade here — shade is recorded when yarn comes back.
No money anywhere in the app — no rates, no amounts, no bills.

### Masters

- **Deniers** — user-added, starts empty, inline add form pattern
- **Job workers** — user-added, inline add form pattern
- Inline add = "add" button next to dropdown opens the same entry form

OPEN QUESTIONS (owner to answer):

### 3. Job work return — NOT YET SPECCED

### 4. Packing — NOT YET SPECCED

### 5. Sales challan — NOT YET SPECCED

### 6. Stock — NOT YET SPECCED

### 7. Reports — NOT YET SPECCED

### 8. Members / roles — NOT YET SPECCED

### 9. Settings — NOT YET SPECCED

## Tech stack

- Frontend: React 19 + Vite SPA + Tailwind v4
- Backend: Hono as Cloudflare Pages Functions
- Database: Cloudflare D1 (SQLite) via Drizzle async driver
- Hosting: Cloudflare free tier — Pages (app: static SPA + Functions API), Workers (website via OpenNext)
- Challan PDFs: `pdf-lib` + shared template (`src/shared/pdf-template.ts`) — server and offline render byte-identical HQ vector PDFs (pure JS, no Browser quota, works fully offline on Electron/PC)
- Builds + deploys happen in CI (GitHub Actions + wrangler-action); no VM anywhere

### Infrastructure policy (owner-mandated)

Free forever ($0 — not even a domain purchase), trusted long-lived providers
only (Cloudflare/GitHub class), zero lock-in (D1 exports plain SQLite dumps +
static bundles + env-var config — instant migration off Cloudflare), minimal
footprint (stay inside the Cloudflare free tier; no added services without
owner approval), minimal maintenance. See AGENTS.md §4.2 for the full rule.

Hosting move (decided 2026-08-30): everything on Cloudflare free tier —
**app on Pages (`*.pages.dev`), website on Workers (`*.workers.dev`), DB on D1**.
Google VM, Docker, Caddy, and the deSEC domain are all removed. The app is in
dev (no production users), so old hostnames `katariasyntex.dedyn.io` /
`app.katariasyntex.dedyn.io` retire without client migration. Final project
names / URLs and any future custom (free, no-purchase) domain: TBD with owner.
API stays same-origin with the SPA (`/api/...` via Pages Functions); cookies
stay Lax, no CORS. Full plan: `apps/app/CLOUDFLARE.md`.
Pingram stays despite per-message cost (owner-approved exception).

### PENDING OWNER DECISIONS — ask before implementing

1. **Website inquiry form destination** — decided 2026-08-31: **separate D1**
   for website (`kataria-web-inquiry`) — inquiries isolated from app D1, both
   on same Cloudflare account, free tier. No CORS to app DB.

### Platforms (all three maintained)

| Platform | Shell     | Session storage                                          |
| -------- | --------- | -------------------------------------------------------- |
| Web/PWA  | Browser   | HttpOnly cookie                                          |
| Desktop  | Electron  | Bearer token in OS keychain (safeStorage via IPC bridge) |
| Mobile   | Capacitor | Bearer token in secure storage plugin                    |

- One codebase (`src/main`) serves all three; platform differences live only
  in `lib/platform.ts` + `lib/api.ts`.
- PWA: service worker + manifest ship in every web/Android build
  (`vite-plugin-pwa`, icons in `public/`).
- Electron: main + preload compiled with Bun (`dist-electron/`), renderer is
  the same `dist/` bundle; packaged with electron-builder in CI.

### Build targets (owner decision 2026-08-25)

| Target  | Ships                                                 |
| ------- | ----------------------------------------------------- |
| Android | **Universal APK** (all CPU archs, one file, signed)   |
| Windows | NSIS installer, **x64 only**                          |
| macOS   | DMG, **Apple Silicon only** (arm64 — no Intel builds) |
| Linux   | AppImage, x64                                         |
| iOS     | **Skipped completely** — no build path, don't ask     |

## Auth & security rules

One login screen. No separate signup/login modes.

### Identifier

- Single input: phone number **or** email, auto-detected by format.
  Phone → normalized E.164; email → lowercased.
- `POST /auth/lookup` answers `{exists, hasPassword, hasInvite}` and drives
  the smart routing below. Plain answer — internal trusted app.

### Routing

- **Exists in DB** → login as that account:
  - OTP screen (SMS via Pingram for phone, Pingram email for email), or
  - password option shown only if the account has a password hash.
- **Not in DB** → create account: name (+ workspace name only when no pending
  invite) → password optional (**hidden entirely for pre-added members**) →
  OTP verify → in.
- **Pre-added member** logs in → lands directly in the inviting workspace,
  never sees account creation. Members are OTP-only, no passwords.
- Brand-new person with no pending invite still creates their own workspace
  (primary admin + company).

### Password storage model (decided 2026-08-31)

- Passwords hash **server-side** — the client sends the password as-is; no
  client-side hashing (owner call: client-side hashing is not trusted).
- Hash is native `scrypt` from `node:crypto` (requires the `nodejs_compat`
  flag), stored as `scrypt$N$r$p$salt$hash`; verification is timing-safe.
- Cloudflare's 10 ms free-tier CPU limit is below a scrypt run (~30–80 ms).
  This is safe by design: isolates tolerate infrequent overruns, logins are
  rare, and lockout/rate limits cap abuse. Real CPU time is verified in
  local workerd before shipping.

### QR login (primary path)

- Desktop shows a QR encoding a URL (`/login/scan/<code>`) — any camera device
  can scan it; the approve page opens in that device's browser/app.
- Unlimited creation — a pending code grants nothing until an
  already-logged-in device approves it. Hardening:
  - code = 16 chars unambiguous alphabet (`XXXX-XXXX-XXXX-XXXX`), ~2^79 space
  - single-use claim (CAS), 10-minute TTL, approve requires auth session
  - status-poll budget generous (600/IP) so normal polling never blocks
- `/qr/start` accepts an optional identifier; approval then names exactly who
  will be logged in ("Log in Ramesh?"). Without it, approval grants the
  approver's own account to the scanning device.
- OTP-quota fallback: member requests login, SMS/email quota exhausted →
  their screen flips to "show QR" → owner scans from logged-in app → member
  is in without any OTP.

### Removed

- Pair codes (replaced by URL-QR). No invite codes typed by hand — membership
  resolves by identifier match at first login/signup.
- Passwords never required: admins may skip (OTP-only accounts); members
  cannot set one.

### Limits

- OTP limits stay tight (5/identifier/hr, 30s resend, 3 wrong tries per code) —
  they protect paid SMS/email.
- Password login: lockout after 10 fails / 15 min window.

## Design language (mandatory for every screen)

- Style: **Vercel × Luma × shadcn** (refined 2026-08-29, owner-approved) — flat,
  border-only, tight `0.5rem` radius, no `shadow-soft` (borders carry the
  structure), `oklch` zinc neutrals (`--background 0.99`, `--border 0.922`).
  Foundation lives in `src/main/ui/globals.css` (do NOT fork per-page styles;
  extend tokens there). This refines — not replaces — the original Luma
  minimal/minimal-whitespace intent.
- Stack: shadcn/ui components + Tailwind v4 utility classes only.
- Inter Variable, `0.5rem` radius, flat cards (`rounded-lg border`), buttons
  `h-8 rounded-md text-[13px] font-medium` with `bg-foreground` primary
  (Vercel monochrome); secondary/ghost use `bg-muted`. `oklch` accent tokens
  remain for focus rings/charts but primary CTA is monochrome unless owner
  asks for accent CTA.
- Responsive first-class: mobile cards → desktop grids; 44px touch targets;
  safe-area aware; dark mode + reduced-motion respected.
- **NO spinners, anywhere.** Loading screens/states = `Skeleton` shimmer
  blocks (from `@/ui/components/motion`) only. Buttons in loading state show
  a skeleton pill. Never add `animate-spin`, `Loader2`, or a Spinner
  component.
- **Copywriting:** Real software only — zero marketing slop or conversational
  filler. 1–2 lines max, direct and factual with zero overexplanation.
- Professionalism bar: a page is done when it looks like a polished product,
  not an admin demo (Vercel/Linear/Stripe bar).
- **Working agreement for this redesign (owner-mandated 2026-08-29):** Ask
  questions **ONE at a time**, fix/build **ONE thing at a time**. Every choice
  goes to owner; never decide silently.

## Limits, timeouts, constraints

TO BE DECIDED.

## Old code policy

- Old `src` archived at `dead-files/apps/app/v1-src/` — REFERENCE ONLY.
- While building a feature: consult matching old file for ideas, then delete that
  old file once the feature is implemented in the new code.
