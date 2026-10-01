# apps/web — product reference

Public website for Kataria Syntex. Facts here are verified against code —
update this doc in the same change as the code. Current state only.

**Owns:** pages, routes, inquiry flow, images/fonts, SEO, env facts for
this site.
**Does not own:** design values (`design.md`) · ops/CI/deploy (`DEPLOY.md`)
· agent rules (`AGENTS.md`) · repo layout (`README.md`).

---

## 1 · What it is

The public showcase for Kataria Syntex — a B2B yarn dealer and sourcing
partner in Surat. One brand, two surfaces: the light showcase here and the
navy print identity (`design.md` Section 2.1, Section 6).

- Not an ecommerce site — inquiries are the conversion: a buyer sends a
  requirement, the team quotes directly.
- No cart, no payment, no pricing.

## 2 · Stack & place in the repo

`apps/web` is a separate product from the business app (`apps/app`) — its
own worker, own D1, own design identity.

| Layer     | Tech                                                  |
| --------- | ----------------------------------------------------- |
| Framework | Next.js 16 (App Router) + React 19                    |
| Styling   | Tailwind v4, self-hosted fonts (zero CDN)             |
| Runtime   | vinext (beta) on Cloudflare Workers                   |
| Build     | Vite via `@cloudflare/vite-plugin` (`vite.config.ts`) |
| Data      | D1 `ks-web-db`, one table (`inquiries`)               |
| Content   | `src/content/*` + `packages/shared`                   |

Commands: `AGENTS.md` Section 3.

## 3 · Source map

```
apps/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # root metadata + viewport + skip link
│   │   ├── globals.css         # @font-face for the three families
│   │   ├── robots.ts           # allow-all
│   │   ├── sitemap.ts          # static routes + every product slug
│   │   ├── not-found.tsx       # 404 page
│   │   ├── fonts/              # 8 woff2 files (Inter, Space Grotesk, Plex Mono)
│   │   ├── api/inquiry/route.ts   # POST handler, D1 insert
│   │   ├── links/               # visiting-card page (dynamic)
│   │   │   ├── page.tsx · error.tsx · loading.tsx
│   │   └── (main)/             # route group with the shared header/footer
│   │       ├── layout.tsx · page.tsx (home)
│   │       ├── about/page.tsx
│   │       ├── contact/        # page.tsx · error.tsx · loading.tsx
│   │       ├── products/page.tsx · products/[slug]/page.tsx
│   │       └── shade-card/page.tsx
│   ├── components/
│   │   ├── home/               # Hero, Process, Markets, YarnIndex, ShadeStrip…
│   │   ├── shade/              # ShadeExplorer, YarnSwatch, thread.ts, woven.ts
│   │   ├── products/           # ProductCard, ProductIndex
│   │   ├── contact/InquiryForm.tsx
│   │   ├── links/BusinessCard.tsx
│   │   ├── layout/             # SiteHeader, SiteFooter
│   │   ├── section/            # Section, SectionHead, PageHead, CtaPanel
│   │   ├── motion/Reveal.tsx
│   │   └── ui/                 # button, dialog, accordion, badge, filter-pill,
│   │                           # input, textarea
│   ├── content/                # site, nav, links, markets, testimonials
│   └── lib/                    # hours.ts (open-now logic) + use-flip,
│                               # use-in-view-once, use-prefers-reduced-motion
├── public/images/              # 3 pre-optimized static WebP files
├── drizzle/                    # 0001_inquiry.sql (the one migration)
├── wrangler.jsonc              # worker web + INQUIRY_DB + ASSETS
└── vinext + next + vite configs
```

## 4 · Pages

| Route              | What                                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `/`                | showcase home — hero, process, markets, yarn index, shade strip, CTA                                                        |
| `/about`           | company story                                                                                                               |
| `/contact`         | inquiry form + details                                                                                                      |
| `/products`        | product index                                                                                                               |
| `/products/[slug]` | product detail (dynamic)                                                                                                    |
| `/shade-card`      | online shade explorer                                                                                                       |
| `/links`           | visiting-card page (dynamic) — open-now status rendered server-side, then refreshed client-side every 30 s and on tab focus |
| `/api/inquiry`     | POST handler → D1 insert                                                                                                    |

## 5 · Inquiry flow

`src/app/api/inquiry/route.ts` — POST → validate → insert into the
`inquiries` table (`ks-web-db`). No email or webhook notification —
checking the table is a manual step.

## 6 · Images and fonts

- **Images** — `next.config.ts` sets `images: { unoptimized: true }`: the
  Cloudflare adapter has no server-side optimizer behind `/_next/image`
  (that needs the paid Images binding), so files are served as-is. Three
  pre-optimized static WebP files live in `public/images/`
  (`cotton-yarn.webp`, `polyester-yarn.webp`, `dyed-yarn.webp`) and
  products share them — 6 product entries, 3 image files.
- **Fonts** — three families self-hosted as woff2 in `src/app/fonts/`,
  declared with `@font-face` in `globals.css`: Space Grotesk Variable
  (display), Inter Variable (body), IBM Plex Mono (shade codes, stats,
  fine print). Zero CDN, zero network font requests.

## 7 · SEO surfaces

- `src/app/layout.tsx` metadata — `metadataBase`, title template
  (`%s — <name>`), description, `openGraph` with **only** `siteName` +
  `type`. No `og:image`, no Twitter card, no `alternates.canonical`.
- `src/app/sitemap.ts` — the 6 static routes plus all 6 product slugs.
- `src/app/robots.ts` — `allow: "/"` for everyone, no `disallow`, so
  `/api/inquiry` is crawlable too.
- No JSON-LD anywhere, including on product detail pages.

## 8 · Environment

- `wrangler.jsonc` — worker `web`, `compatibility_date 2026-08-30`,
  `nodejs_compat`, an `ASSETS` binding over `dist/client`, the
  `INQUIRY_DB` binding, and observability. The D1 `database_id` is a zero
  placeholder — CI provisions the real database and substitutes the id
  before the build (`pipeline.yml`).
- `NEXT_PUBLIC_SITE_URL` — set in `wrangler.jsonc` to
  `https://web.katariasyntex.workers.dev`; `src/content/site.ts` repeats the
  same value as its `??` fallback. It feeds `metadataBase`, the sitemap,
  `robots.txt` and the `/links` Website row.
- `pipeline.yml` supplies `NEXT_PUBLIC_SITE_URL` to the build from the repo
  variable `NEXT_PUBLIC_SITE_URL`, else `SITE_URL`, else the production
  worker domain — so a repo variable overrides the `wrangler.jsonc` value.

## 9 · Deployment

Owned by `DEPLOY.md`. Site-specific facts: the deploy job ensures
`ks-web-db` exists, injects its id, applies `drizzle/`, then builds and
deploys via `vinext-cloudflare`. The D1 id must be injected **before** the
build — vinext bakes it into the worker. Migration path off the platform:
`wrangler d1 export ks-web-db` (plain SQLite).

## 10 · Known gaps (current state)

- `/products/[slug]` has no `error.tsx` or `loading.tsx`; `/links` and
  `/contact` have both.
- `SiteHeader`''s mobile menu is a `fixed inset-0` Dialog
  (`components/ui/dialog.tsx`) whose inner column (`SiteHeader.tsx:112`)
  has no `overflow-y-auto`; in landscape the last links and "Send inquiry"
  clip (~504px of content in a 390px viewport). Portrait is fine.
- No `og:image`, Twitter card or canonical URL (Section 7); sharing
  renders a text-only card.
- Product images serve at ~3× the needed resolution at their render size.
