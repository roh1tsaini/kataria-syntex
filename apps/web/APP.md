# APP.md — apps/web reference (maintained)

Single maintained doc for the public website. Kept current with the code —
**code is truth**; update this doc in the same change that updates code.

**Maintaining rules**

- Change code → change this doc in the same commit. No stale lines.
- New route/page/section → add a row. Removed thing → delete the row.
- Numbers here are verified against constants in code. When they disagree,
  fix the doc or the code — never let both drift.
- Current state only: describe what IS. No past talk, no change history.

---

## 1 · What this is

The public showcase for Kataria Syntex — a B2B yarn dealer and sourcing
partner in Surat. One brand, two surfaces: the light showcase here and the
navy print identity (`design.md` Section 2.1, Section 6). This doc describes the product;
the design system is `apps/web/design.md`.

Not an ecommerce site. Inquiries are the conversion: a buyer sends a
requirement, the team quotes directly. No cart, no payment, no pricing.

## 2 · Monorepo

Bun workspaces + Turborepo. Bun is the only package manager (`bun@1.4.2`).
`apps/web` is a separate product from the business app (`apps/app`) — its
own worker, own D1, own design identity.

| Path              | Role                                            |
| ----------------- | ----------------------------------------------- |
| `apps/web`        | Public website (this doc)                       |
| `packages/shared` | Company facts, product + shade data, validation |

Commands:

```bash
bun install
# inside apps/web
bun run dev      # vinext dev --port 3000
bun run build    # vinext build
bun run lint     # gate
```

## 3 · Tech stack

| Layer     | Tech                                                  |
| --------- | ----------------------------------------------------- |
| Framework | Next.js 16 (App Router) + React 19                    |
| Styling   | Tailwind v4, self-hosted fonts (zero CDN)             |
| Runtime   | vinext (beta) on Cloudflare Workers                   |
| Build     | Vite via `@cloudflare/vite-plugin` (`vite.config.ts`) |
| Data      | D1 `ks-web-db`, one table (`inquiries`)               |
| Content   | `src/content/*` + `packages/shared`                   |
| CI        | GitHub Actions (`pipeline.yml` — `deploy` job)        |

## 4 · Source map

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
│   │   ├── links/page.tsx      # visiting-card page (dynamic)
│   │   └── (main)/             # route group with the shared header/footer
│   │       ├── layout.tsx · page.tsx (home)
│   │       ├── about/page.tsx · contact/page.tsx
│   │       ├── products/page.tsx · products/[slug]/page.tsx
│   │       └── shade-card/page.tsx
│   ├── components/
│   │   ├── home/               # Hero, Process, Markets, YarnIndex, ShadeStrip…
│   │   ├── shade/              # ShadeExplorer, YarnSwatch, thread.ts, woven.ts
│   │   ├── products/          # ProductCard, ProductIndex
│   │   ├── contact/InquiryForm.tsx
│   │   ├── links/BusinessCard.tsx
│   │   ├── layout/             # SiteHeader (mobile = Dialog), SiteFooter
│   │   ├── section/            # Section, PageHead, CtaPanel — the band grammar
│   │   ├── motion/             # Reveal (intersection observer)
│   │   └── ui/                 # button, input, textarea, dialog, badge…
│   ├── content/                # site, nav, links, markets, testimonials
│   └── lib/                    # hours.ts (open/closed), hooks (flip, in-view, reduced-motion)
├── drizzle/0001_inquiry.sql    # the one table
├── public/                     # images (3 webp), theme-fonts, brand-kit.html
├── next.config.ts · vite.config.ts · tsconfig.json
└── wrangler.jsonc              # worker `web`, INQUIRY_DB binding, ASSETS
```

## 5 · Routes

| Route              | Page                                                | Dynamic?                              |
| ------------------ | --------------------------------------------------- | ------------------------------------- |
| `/`                | Home (hero → process → markets → products → shades) | static                                |
| `/products`        | Product index with filters                          | static                                |
| `/products/[slug]` | Product detail                                      | **dynamic** (6 slugs)                 |
| `/shade-card`      | Shade explorer                                      | static                                |
| `/about`           | Company, trust metrics, FAQs                        | static                                |
| `/contact`         | Inquiry form + Google Maps embed                    | static                                |
| `/links`           | Visiting card + open/closed status                  | **dynamic** (renders at request time) |
| `/api/inquiry`     | POST handler                                        | force-dynamic                         |

Page anatomy is the band grammar — `design.md` Section 3 is the single source of
truth for it.

## 6 · Content model

- **Company facts** — `COMPANY_DETAILS` in `packages/shared/src/index.ts`:
  name, tagline, established year, location, phone, email. The single source
  of truth across the monorepo; `src/content/site.ts` reads it and adds
  website-only fields (hours, schedule, socials, trust metrics, FAQs). The
  trust-metric counts (`yearsOfExperience`, export countries, high-demand
  states) are computed from `site.establishedYear` and
  `src/content/markets.ts`.
- **Products** — `products` in `packages/shared/src/products.ts`: 6 yarn
  products (combed/carded cotton, polyester spun + DTY, dyed cotton +
  polyester). Each carries a slug, an image path and alt text.
- **Shades** — `shades` + `shadePages` in `packages/shared/src/shades.ts`:
  149 shades transcribed from the physical RAJ embroidery yarn shade card
  across 6 pages (7–12). `multiColors` holds the melange/space-dyed threads.
- **Markets** — `exportCountries` (20) and `indianStates` (15) in
  `src/content/markets.ts`; `trustMetrics` derives its counts from these.
- **Nav, links, testimonials** — `src/content/nav.ts`, `links.ts`,
  `testimonials.ts`.

## 7 · Inquiry flow

1. `InquiryForm.tsx` (`"use client"`) validates against `inquirySchema` from
   `packages/shared`. A started draft persists to `localStorage`
   (`ks-inquiry-draft`) so a buyer can begin on a product page and finish on
   `/contact`; it loads after mount to keep SSR and first client render
   matching.
2. `POST /api/inquiry` — a honeypot `website` field returns `{ ok: true }`
   and drops the submission. Zod shapes the body; per-IP rate limit of 5
   submissions / 15 min (`429`). Responses are `no-store`.
3. The row lands in D1 through the `INQUIRY_DB` binding — table `inquiries`
   (`drizzle/0001_inquiry.sql`): id, name, company, email, phone, country,
   product, shade, quantity, message, ip, user_agent, created_at. Indexes on
   email, created_at, ip.
4. A missing binding fails loudly in production (`500`) rather than
   discarding an inquiry; in dev it warns and returns ok.

Inquiries sit in `ks-web-db` until read. There is no email or webhook
notification — checking the table is a manual step.

## 8 · Images and fonts

- **Images** — `next.config.ts` sets `images: { unoptimized: true }`: the
  Cloudflare adapter has no server-side optimizer behind `/_next/image`
  (that needs the paid Images binding), so files are served as-is. Three
  pre-optimized static WebP files live in `public/images/`
  (`cotton-yarn.webp`, `polyester-yarn.webp`, `dyed-yarn.webp`) and products
  share them — 6 product entries, 3 image files.
- **Fonts** — three families self-hosted as woff2 in `src/app/fonts/` and
  declared with `@font-face` in `globals.css`: **Space Grotesk Variable**
  (display), **Inter Variable** (body), **IBM Plex Mono** (shade codes,
  stats, fine print). Zero CDN, zero network font requests.

## 9 · SEO surfaces

- `src/app/layout.tsx` metadata — `metadataBase`, a title template
  (`%s — <name>`), description, and `openGraph` with **only** `siteName` +
  `type`. No `og:image`, no Twitter card, no `alternates.canonical`.
- `src/app/sitemap.ts` — the 6 static routes plus all 6 product slugs.
- `src/app/robots.ts` — `allow: "/"` for everyone, no `disallow`, so
  `/api/inquiry` is crawlable too.
- No JSON-LD anywhere, including on product detail pages.

## 10 · Environment

`wrangler.jsonc` declares the worker `web`, `compatibility_date 2026-08-30`,
`nodejs_compat`, an `ASSETS` binding over `dist/client`, the `INQUIRY_DB`
binding, and observability. The D1 `database_id` is a zero placeholder — CI
provisions the real database and substitutes the id before the build
(`pipeline.yml`).

`NEXT_PUBLIC_SITE_URL` is set in neither `wrangler.jsonc` nor the CI
workflow, so `src/content/site.ts` falls back to
`https://web.katariasyntex.workers.dev` — and that fallback is the baked
production value. It feeds `metadataBase`, the sitemap, `robots.txt` and the
`/links` Website row.

## 11 · Deployment

The `deploy` job in `.github/workflows/pipeline.yml`, in order:

1. Ensure `ks-web-db` exists (auto-provision via the Cloudflare API if
   missing), then `sed` the real id into `wrangler.jsonc`.
2. `bunx wrangler d1 migrations apply ks-web-db --remote`.
3. `bun run build` — vinext bakes the D1 id into the worker, so the build
   must run **after** the id is injected.
4. `bunx vinext-cloudflare deploy --skip-build`.

`wrangler d1 export ks-web-db` is the whole migration path off the platform —
plain SQLite, zero lock-in (AGENTS.md Section 4.2).

## 12 · Known gaps (current state)

- No `error.tsx` or `loading.tsx` on any route — the dynamic `/links` and
  `/products/[slug]` pages have no streaming or error boundary.
- `SiteHeader`'s mobile menu is a `fixed inset-0` Dialog
  (`components/ui/dialog.tsx`) whose inner column
  (`SiteHeader.tsx:112`) has no `overflow-y-auto`; in landscape the last
  links and "Send inquiry" clip (~504px of content in a 390px viewport).
  Portrait is fine.
- `/links` computes `openStatus()` server-side from `lib/hours.ts` and never
  re-checks client-side — a page opened at 6:55 PM shows "Open now · till
  7:00 PM" past closing, wrong for the exact visitor who needs it.
- No `og:image`, Twitter card or canonical URL (Section 9); sharing renders a
  text-only card.
- Product images serve at ~3× the needed resolution at their render size.

## 13 · Pointers

- `apps/web/design.md` — the design system (band grammar, tokens, motion).
- `apps/app/APP.md` — the business app (separate product, separate worker).
- `packages/shared/src/index.ts` — `COMPANY_DETAILS`, the brand facts.
