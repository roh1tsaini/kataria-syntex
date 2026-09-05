# design.md — apps/web design system (single source of truth)

> One brand, two surfaces: a light, airy showcase site and a navy print
> identity. Every page must look like the same product built by one hand, and
> the same blue family that goes on the visiting card. **If a value is not in
> this document, do not invent one — extend this document first (owner
> approves), then use it.**
>
> Applies to `apps/web` ONLY. `apps/app` has its own identity.
> Tokens live in `src/app/globals.css` — code never hardcodes what a token
> already provides. Brand blues were locked by the owner on 2026-09-01
> (combo of navy + royal + sky + ice); they replace the old ecru/madder
> identity, which is dead and gets deleted with the redesign.

## 1. Principles

1. **Calm.** Whitespace is the design. One accent per section; the blues do
   the talking, never decoration.
2. **Consistent.** Same control = same shape, size, spacing, behavior on
   every page. A button on Home and a button on Contact are identical.
3. **Two surfaces, one family.** Light bands (canvas, canvas-deep) and dark
   bands (navy) alternate with intent; both use the same blue ramp. White is
   reserved for cards and controls — the page itself is always blue
   (owner call 2026-09-02: the site never sits on white).
4. **Legible.** Hierarchy from weight + size + color. Borders are hairlines;
   shadows are whispers; no gradients on text.
5. **Print-twin.** The brand must survive CMYK: navy carries ink-heavy
   surfaces, sky is the single spot accent. What prints is what ships.
6. **Respectful.** Reduced motion, high contrast, 44px touch targets —
   always on, never opt-in.

## 2. Foundations

### 2.1 Brand color (owner-locked)

| Token          | Hex       | CMYK (approx, proof before print) | Role                                                    |
| -------------- | --------- | --------------------------------- | ------------------------------------------------------- |
| `--navy`       | `#0A2540` | C85 M42 Y0 K75                    | ink on light; dark surfaces (bands, footer, card front) |
| `--royal`      | `#1E3A8A` | C78 M58 Y0 K46                    | primary action on light (buttons, links, kickers)       |
| `--sky`        | `#7DD3FC` | C50 M16 Y0 K1                     | accent on dark (numbers, tags, buttons on navy)         |
| `--ice`        | `#B8D8F5` | C25 M12 Y0 K4                     | accent surface (chips, tags, card back)                 |
| `--cornflower` | `#93C5FD` | C42 M22 Y0 K1                     | links/secondary accent on dark                          |

Ramp (gradients, tints, charts) — one family, use in order, never interpolate
outside it:

`#0A2540 → #1E3A8A → #3C5DA7 → #5980C4 → #76A2E0 → #93C5FD`

Neutrals (blue-tinted, never warm):

| Token           | Value                     | Role                                        |
| --------------- | ------------------------- | ------------------------------------------- |
| `--paper`       | `#FFFFFF`                 | cards, panels, controls (never the page bg) |
| `--canvas`      | `#E6F0FB`                 | page background — every page, always        |
| `--canvas-deep` | `#D4E7F7`                 | recessed light band background              |
| `--ink-soft`    | `#46586E`                 | body copy on light                          |
| `--line`        | `rgb(10 37 64 / 0.12)`    | hairline borders on light                   |
| `--line-dark`   | `rgb(125 211 252 / 0.15)` | hairline borders on navy                    |
| `--ice-soft`    | `rgb(184 216 245 / 0.72)` | body copy on navy                           |

Rules:

- Semantic tokens only in components; never raw hex outside `globals.css`.
- On light: headings navy, body ink-soft, actions royal, kicker royal.
- On navy: headings white, body ice-soft, actions sky (navy text), links
  cornflower, kickers/numbers sky.
- Sky on light is decoration only (chips, highlights) — never text on white.
- Status/semantic colors (error etc.) stay separate from brand blues.

### 2.2 Spacing grid — 4px base

| Use               | Value                           |
| ----------------- | ------------------------------- |
| Inline gaps       | 8–12px                          |
| Card padding      | 20–24px                         |
| Card grid gap     | 18–24px                         |
| Section padding-y | 56px mobile, 84px desktop       |
| Page gutter       | 16px mobile, 24px ≥sm, 32px ≥lg |
| Content max width | 1180px                          |

### 2.3 Radius ladder

| Value | Used for                                      |
| ----- | --------------------------------------------- |
| 8px   | shade chips, small chips, code blocks         |
| 11px  | buttons, inputs                               |
| 16px  | cards, panels                                 |
| 18px  | feature panels, floating visuals (shade card) |
| pill  | tags/eyebrow badges only                      |

A control's radius never depends on its page.

### 2.4 Control heights

| Use              | Height                         |
| ---------------- | ------------------------------ |
| Nav bar          | 64px                           |
| Buttons/inputs   | 44px desktop, 48px primary CTA |
| Touch targets    | min 44×44px                    |
| Small nav button | 36px                           |

### 2.5 Type (self-hosted, zero CDN)

- **Display:** Space Grotesk Variable — headings only.
- **Body:** Inter Variable — everything else.
- **Mono:** IBM Plex Mono — shade codes, stats, fine print, data.

| Role           | Size           | Family/weight     | Tracking | Leading |
| -------------- | -------------- | ----------------- | -------- | ------- |
| Display (hero) | clamp(40→60px) | Grotesk 700       | −0.03em  | 1.05    |
| Section head   | clamp(28→38px) | Grotesk 700       | −0.02em  | 1.1     |
| Card title     | 17–20px        | Inter 700         | −0.01em  | 1.3     |
| Body           | 15–17px fluid  | Inter 400         | −0.011em | 1.6     |
| Eyebrow/kicker | 11px uppercase | Inter 700         | +0.07em  | 1       |
| Data/mono      | 12–13px        | Plex Mono 400/500 | 0        | 1.5     |

Hierarchy is weight + size + color. No italic display, no text-transform on
body copy.

### 2.6 Shadows & materials

- Cards rest flat with `--line` hairlines; interactive cards lift
  `0 8px 24px rgb(10 37 64 / 0.08)` on hover, −1px translate, 140ms.
- Floating visuals (shade-card panel): `0 24px 48px rgb(10 37 64 / 0.14)`.
- Sticky nav: transparent over the canvas at top; solid `bg-canvas` +
  hairline bottom once scrolled. **No `backdrop-blur`** — the per-frame GPU
  filter while scrolling is a jank source.

### 2.7 Wound-yarn swatch texture (product content only)

The physical RAJ shade card is yarn wound edge to edge; the site reproduces
that with a pure-CSS texture engine (`src/components/shade/woven.ts` +
`YarnSwatch.tsx`) — never flat color boxes for shade swatches:

- **Strands:** each row is a cylinder lit from above — highlight crown,
  body, press-shadow where the next strand squeezes against it.
- **Overlays:** fine ply-twist hairlines (96deg), a long-period luminance
  drift so rows never repeat machine-perfectly, and a shared SVG
  feTurbulence grain blended `overlay` for fiber fuzz.
- **Melange:** multi-color yarns cycle their palette one strand per row
  (1, 2, 3, … N, 1, …) — matching the wrapped thread on the physical card.
- **Wrap:** rounded corners + inset shadows (top catch of light, side and
  bottom press-shadow) make the band read as raised yarn on a card.
- `rowHeight` scales with swatch size (6px hero chips → 13px detail).
- Texture is for product shade content ONLY — brand blues (navy/royal/sky/
  ice) never get yarn texture. Codes print beneath the swatch in Plex Mono,
  like the printed card.

### 2.8 Buttons

| Variant | Style                                  | Use                      |
| ------- | -------------------------------------- | ------------------------ |
| primary | royal fill, white text                 | one per section on light |
| on-dark | sky fill, navy text                    | one per section on navy  |
| ghost   | 1.5px currentColor border, transparent | secondary                |
| link    | royal (light) / cornflower (dark), 600 | inline actions           |

Press: `scale(0.97)` @100ms on `:active`. Radius 11px, height per §2.4.

## 3. Section grammar (page anatomy)

Pages are alternating bands, always in this visual order when present:

1. **Hero (light):** sits directly on the shared blue canvas (owner call
   2026-09-02: light blue everywhere — no white page tops, no ice gradient
   wash); eyebrow pill, display head (navy, one royal emphasis line max),
   lede ink-soft, primary + ghost, mono fine-print line. Optional floating
   panel on the right (shade card).
2. **Stats band (navy):** 3–4 mono-labeled stats; numbers sky 26–28px
   Grotesk, labels ice-soft 12.5px.
3. **Index/cards (light, canvas-deep bg allowed):** kicker royal, section head,
   sub, equal-height card grid (16px radius, hairline, family chip row).
4. **Process (navy):** kicker sky, mono numbers sky, 3 steps max per row.
5. **CTA band:** navy→royal 120° gradient; head white; sky primary +
   cornflower ghost.
6. **Footer (navy):** compact 4-column grid — brand + trade summary,
   contact, desk hours, page index — ice-soft text, cornflower→sky links,
   mono © line at the bottom under a `--line-dark` hairline. Contact stays
   reachable from every page (business requirement).

Rules: never two dark bands adjacent; never more than one primary button per
band; product data (yarn specs, shades) comes from `src/content/*`, never
hardcoded in components.

## 4. Motion grammar

Presets live with `src/components/motion/*` (Reveal, SmoothScroll) — import
them, never re-derive.

1. Enter = fade + 4–6px rise, ≤240ms, `cubic-bezier(0.16,1,0.3,1)`; siblings
   stagger 40ms, max 5.
2. Scroll reveals fire once, only above the fold edge; content is fully
   visible without JS.
3. **Load-in:** above-the-fold hero content enters once on page load with
   the same fade + rise (`ks-enter`, 640ms, same curve); siblings stagger
   40–60ms. Pure CSS, runs before hydration, collapses under reduced motion.
4. Animate transform + opacity only. Never animate `filter` (e.g. blur
   crossfades) — it repaints per frame.
5. No parallax, no looping backgrounds, no hover scale >1, no spinners —
   skeletons for async content.
6. `prefers-reduced-motion`: everything collapses to opacity ≤200ms.

### 4.1 Smooth scroll (Lenis) integration rules

SmoothScroll is the only place Lenis is configured. Non-negotiables that
keep the main thread free while it drives scroll per frame:

- `autoRaf: true` — Lenis owns its rAF loop; never run a second one.
- `lerp 0.14, anchors: true`; touch stays native (`syncTouch` off).
- While any Radix modal is open, Lenis parks: `body[data-scroll-locked]`
  is watched and `lenis.stop()` / `lenis.start()` wrap it.
- Internally scrollable containers carry
  `data-lenis-prevent` so gestures scroll the container, not the page.
- Heavy grids (shade-card page groups) use the `paint-gate` utility
  (`content-visibility: auto` + `contain-intrinsic-size`) so off-screen
  groups never raster their texture layers while scrolling.
- No `backdrop-blur` anywhere that sits over scrolling content.

## 5. Accessibility floor (non-negotiable)

- 44×44px touch targets; visible focus ring (2px royal on light, 2px sky on
  dark, 2px offset).
- Contrast ≥4.5:1 body / 3:1 large: ink-soft on paper, ice-soft on navy,
  white on royal all pass; sky is never body text on light.
- Labels on every input; `aria-invalid` + inline error text; semantic
  heading order per band.

## 6. Print (visiting card + shade card)

- **Card front:** navy field, white name, sky role line + sky logo dot.
  Navy = C85 M42 Y0 K75, sky = C50 M16 Y0 K1 (one solid + one spot).
- **Card back:** ice field, navy mono text. Ice = C25 M12 Y0 K4.
- CMYK values are screen→print approximations. **Lock the exact recipe with a
  physical proof before any print run.** On screen, hex is exact.
- The online shade card shows real dyed shades from `src/content/shades.ts`;
  brand blues are chrome, never substituted for product shades.

## 7. Codebase map (where things live)

| Concern                         | File                                           |
| ------------------------------- | ---------------------------------------------- |
| Tokens (color/radius/shadow)    | `src/app/globals.css`                          |
| Fonts (self-hosted WOFF2)       | `src/app/fonts/` + `@font-face` in globals.css |
| Brand/company facts             | `packages/shared` → `src/content/site.ts`      |
| Products/shades/markets content | `src/content/*`                                |
| Motion primitives               | `src/components/motion/*`                      |
| Layout chrome                   | `src/components/layout/*`                      |

## 8. Agent checklist (before any UI change ships)

- [ ] Colors are tokens from §2.1 — no raw hex in components.
- [ ] Band order and anatomy match §3; one primary action per band.
- [ ] Radii/heights/spacing match §2.2–§2.4 — no new magic numbers.
- [ ] Type roles match §2.5; Grotesk only for headings, Plex Mono only for data.
- [ ] Motion per §4, reduced-motion honored, no spinners.
- [ ] 44px targets + focus rings + contrast verified at mobile width.
- [ ] Would it print on the card without breaking §6? If not, rethink.
- [ ] Looks at home next to Luma / Linear / Apple marketing pages. If it reads
      as "bootstrap template", it is not done.
