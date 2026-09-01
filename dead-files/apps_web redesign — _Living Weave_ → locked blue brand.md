# apps/web redesign — "Living Weave" → locked blue brand

## Context

Owner is redesigning `apps/web` for visual consistency with the new brand. On 2026-09-01 the owner locked a combo blue palette (navy `#0A2540`, royal `#1E3A8A`, sky `#7DD3FC`, ice `#B8D8F5`, cornflower `#93C5FD`) after reviewing rendered mocks (`brand-preview.html/png`, `brand-demo.html/png` at repo root — `brand-demo.png` is the pixel reference for the homepage). `apps/web/design.md` was written as the spec. Owner also decided: hero = clean floating shade-card panel (Three.js loom dies), and ALL old craft motifs die (stitch borders, thread-cross, grain overlay, ScrollThread). Old ecru/ink/madder identity is deleted everywhere. `apps/app` stays untouched. Content layer (`src/content/*`, `packages/shared`) is data — unchanged.

Gates (repo root, after every step): `bun run typecheck && bun run lint && bun run format:check && bun run build`.

## Step 1 — Tokens (`apps/web/src/app/globals.css`, atomic edit)

- Replace `@theme inline` colors with: `navy/royal/sky/ice/cornflower/paper #FFFFFF/mist #F4F7FB/ink-soft #46586E/line rgb(10 37 64/0.12)/line-dark rgb(125 211 252/0.15)/ice-soft rgb(184 216 245/0.72)/danger #C10328/success #286E44`. Delete ecru/ecru-deep/ink/madder/rust/ochre/forest/line-strong.
- Add radius tokens (`--radius-chip 8px`, `--radius-control 11px`, `--radius-card 16px`, `--radius-panel 18px`), shadows (`--shadow-card 0 8px 24px rgb(10 37 64/0.08)`, `--shadow-float 0 24px 48px rgb(10 37 64/0.14)`).
- `--ease-out` → `cubic-bezier(0.16,1,0.3,1)` (keep name; many consumers); delete unused `--ease-in-out`, `--ease-drawer`. Keep `--breakpoint-xs`, all `--font-*`, all `@font-face`.
- Fix dead accordion animation: add `--animate-accordion-down/up` tokens + `@keyframes` (radix content-height vars) — `ui/accordion.tsx:56` already references them.
- Base: `body @apply bg-paper text-navy font-body antialiased`; `::selection` sky/navy; `:focus-visible` 2px solid royal offset 2 (sky inside `.bg-navy`); scrollbar recolored navy.
- `.ks-reveal` retime: 240ms, rise 6px (design.md §4); keep `html.js` gate, Lenis CSS, reduced-motion/transparency blocks.
- DELETE `@utility stitch`, `thread-cross`, `grain-overlay`; keep `tnum`.

## Step 2 — ui/ primitives (rename button variants + update all ~12 call sites same step)

- `button.tsx`: variants `primary` (royal/white, hover navy), `on-dark` (sky/navy, hover white), `ghost` (1.5px currentColor), `link` (royal 600). Inter 650 (not mono), `rounded-control`, sizes sm 36 / md 44 / lg 48, `active:scale-[0.97]`. Update header comment (drop Living Weave wording).
- `badge.tsx`: `outline` + `tint` (ice/navy) pills, Inter 11px 700 uppercase.
- `input.tsx`/`textarea.tsx`: `rounded-control border-line h-11 bg-paper focus:border-royal aria-invalid:border-danger`.
- `label.tsx`: mono 11px uppercase navy. `dialog.tsx`: overlay `bg-navy/60`, fullscreen `bg-navy text-paper`, close hover sky (keep `data-lenis-prevent`). `accordion.tsx`: navy/royal/ink-soft, `border-line`.

## Step 3 — Layout chrome

- `app/layout.tsx`: themeColor `#0A2540`; delete grain-overlay div; skip link navy/white.
- `(main)/layout.tsx` + `not-found.tsx`: remove ScrollThread usage.
- `SiteHeader.tsx`: white/85 blur + hairline on scroll; gradient dot (royal→sky, 12px, r4) + Inter 800 wordmark (drop mono microcopy); links ink-soft, active royal; CTA `primary sm`; mobile Dialog = navy fullscreen, Grotesk white links, mono ice-soft numbers, active sky, `on-dark` CTA.
- `SiteFooter.tsx`: navy, ice-soft text, cornflower→sky links, drop thread-cross + "Woven in Surat"; keep compact 4-col contact/hours/nav grid (business reachability); bottom mono © line. (design.md §3.6 updated to match during this step.)
- `SectionHead.tsx`: drop thread-cross; kicker Inter 700 11px +0.07em royal / sky invert; title Grotesk clamp(28→38px) navy/white; lede ink-soft/ice-soft.

## Step 4 — Home rebuild (band order per design.md §3; `(main)/page.tsx` order already matches)

- `Hero.tsx` rewrite: white→ice wash; eyebrow pill; Grotesk clamp(40→60px) navy + one royal emphasis; lede; `primary lg` + `ghost lg`; mono fine line; right = floating shade-card panel (`bg-paper border-line rounded-panel shadow-float`, 6-col grid of real swatches from `content/shades`, labels via existing `isLightShade`, "Open the shade card →" royal). DELETE rAF parallax, dynamic YarnLoom imports, pause toggle, localStorage key.
- `TrustStrip.tsx`: navy band, sky Grotesk numbers (keep count-up), ice-soft mono labels, `line-dark` dividers.
- `YarnIndex.tsx`: mist band; paper cards rounded-card hairline + hover lift; keep product photos; category/link royal.
- `Process.tsx`: navy band, mono sky numbers, white titles, ice-soft body.
- `ShadeStrip.tsx`: real hexes in `rounded-card border-line` band; link royal.
- `Markets.tsx`: light band, paper ledger cards.
- `Testimonials.tsx`: keep crossfade/autoplay; prev/next → 44×44 ghost circles (a11y floor); quote Grotesk navy.
- `CtaBand.tsx`: navy→royal 120° gradient; `on-dark lg` + cornflower ghost; drop thread-cross.

## Step 5 — Deletions + deps

- Delete `components/weave/YarnLoom.tsx` (+ dir) and `components/motion/ScrollThread.tsx` (no references left after Steps 3–4).
- `cd apps/web && bun remove three @types/three`; re-run gates.

## Step 6 — Remaining pages (restyle, keep behavior)

Global sweep: `max-w-[1440px]` → `max-w-[1180px]`, gutters `px-4 sm:px-6 lg:px-8`, section padding 56/84px.

- `about`: stats dl in rounded-card; pillars/buyer rows royal numbers; closing panel navy→royal gradient + `on-dark`.
- `contact` + `InquiryForm`: errors `text-danger`, success `bg-mist` + `text-success`, select restyled like Input, submit `primary`; keep draft/honeypot/tw-animate `animate-in` utilities (valid).
- `products` + `ProductIndex`: pills rounded-full ≥44px (active royal/white); cards rounded-card hover lift.
- `products/[slug]`: image rounded-card; thread-cross bullets → 4px royal dots; CTAs primary+ghost.
- `shade-card` + `ShadeExplorer`: pills like ProductIndex; search rounded-control focus-within royal; active swatch `outline-royal`; keep `isLightShade`, aria-live.
- `links/BusinessCard`: print-twin per design.md §6 — front navy (sky dot, white Grotesk name, sky tagline, status dot sky/danger), drop corner brackets + thread-cross; add static ice "card back" panel with `cardMeta` dl navy mono; link-row hover royal; keep spring tilt + `openStatus`.
- `not-found`: "404 — NOT FOUND" royal mono, copy without weave metaphors, `primary` button.

## Step 7 — Icon + final pass

- `app/icon.svg`: navy rounded field + royal→sky gradient dot.
- `bun run format`; full gates; grep sweep `rg "ecru|madder|rust|ochre|forest|stitch|thread-cross|grain|YarnLoom|ScrollThread" apps/web/src` = zero; confirm no raw hex outside globals.css; `git status` shows no `apps/app` changes.

## Reuse (do not rewrite)

`Reveal`, `SmoothScroll` (Lenis), `usePrefersReducedMotion`, `isLightShade`, `openStatus`, `tnum`, `cn`, MetricValue count-up, Testimonials crossfade engine, InquiryForm draft/honeypot, BusinessCard tilt engine, content exports.

## Risks

- Step 1 must be atomic (tokens + `@apply` together) or build breaks.
- Button variant rename: set explicit variant at every call site (list in Step 2 grep) to avoid silent visual regressions.
- 44px floor resizes pills/arrows — check layout density after.
- `.ks-reveal` retime must keep reduced-motion `translate:0 !important` override.

## Verification

1. Repo-root gates green after each step.
2. `bun run dev:web`, headless screenshots (desktop 1440×900 + mobile 390×844) of `/`, `/about`, `/contact`, `/products`, `/products/combed-cotton-yarn`, `/shade-card`, `/links`, bad URL:
   `"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --window-size=1440,900 --virtual-time-budget=8000 --screenshot=<out> http://localhost:3000/`
3. Compare home render against `brand-demo.png` reference.
4. Reduced motion: `--force-prefers-reduced-motion` — reveals visible, Lenis off, carousel frozen, card static.
5. Mobile: navy fullscreen menu, ≥44px targets, no horizontal overflow, hero panel stacks.
6. Focus pass: royal rings on light, sky rings on navy.