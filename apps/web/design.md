# design.md — apps/web design system (single source of truth)

> One brand, two surfaces: a light, airy showcase site and a navy print
> identity. Every page must look like the same product built by one hand, and
> the same blue family that goes on the visiting card. **If a value is not in
> this document, do not invent one — extend this document first (owner
> approves), then use it.**
>
> Applies to `apps/web` ONLY. `apps/app` has its own identity.
> Tokens live in `src/app/globals.css` — code never hardcodes what a token
> already provides. Brand blues are owner-locked (navy + royal + sky + ice).

## 1. Principles

1. **Calm.** Whitespace is the design. One accent per section; the blues do
   the talking, never decoration.
2. **Consistent.** Same control = same shape, size, spacing, behavior on
   every page. A button on Home and a button on Contact are identical.
3. **Two surfaces, one family.** Light bands (canvas, canvas-deep) and dark
   bands (navy) alternate with intent; both use the same blue ramp. White is
   reserved for cards and controls — the page itself is always blue
   (owner call 2026-09-02: the site never sits on white).
4. **Atmosphere, not flatness.** Light bands carry a brand-blue aurora wash
   (`ks-aurora-light`), a fine blueprint grid (`ks-grid-blue`, radially
   masked), and a fiber-grain overlay (`ks-noise`); navy bands and panels
   carry `ks-aurora-dark` + grain. All static — no looping backgrounds.
5. **Legible.** Hierarchy from weight + size + color. Borders are hairlines;
   shadows are layered whispers; no gradients on text (the footer ghost
   wordmark's vertical fade is the one decorative exception).
6. **Print-twin.** The brand must survive CMYK: navy carries ink-heavy
   surfaces, sky is the single spot accent. What prints is what ships.
7. **Respectful.** Reduced motion, high contrast, 44px touch targets —
   always on, never opt-in.

## 2. Foundations

### 2.1 Brand color (owner-locked)

| Token          | Hex       | CMYK (approx, proof before print) | Role                                                                 |
| -------------- | --------- | --------------------------------- | -------------------------------------------------------------------- |
| `--navy`       | `#0A2540` | C85 M42 Y0 K75                    | ink on light; dark surfaces (bands, panels, footer, card front)      |
| `--royal`      | `#1E3A8A` | C78 M58 Y0 K46                    | primary action on light (buttons, links, kickers); duotone art field |
| `--sky`        | `#7DD3FC` | C50 M16 Y0 K1                     | accent on dark (numbers, tags, buttons on navy)                      |
| `--ice`        | `#B8D8F5` | C25 M12 Y0 K4                     | accent surface (chips, tags, card back)                              |
| `--cornflower` | `#93C5FD` | C42 M22 Y0 K1                     | links/secondary accent on dark                                       |

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
- Atmosphere utilities are named with the `ks-` prefix (`ks-aurora-light`,
  `ks-aurora-dark`, `ks-grid-blue`, `ks-noise`) — never a `bg-` name, so
  `tailwind-merge` cannot mistake them for background-color classes and drop
  `bg-navy` from the same className.
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

| Value | Used for                                            |
| ----- | --------------------------------------------------- |
| 8px   | shade chips, small chips, code blocks               |
| 11px  | buttons, inputs                                     |
| 16px  | cards, panels                                       |
| 18px  | feature panels                                      |
| 24px  | hero panels, stat tiles, CTA tiles (`rounded-hero`) |
| pill  | tags/eyebrow badges, nav links, search field        |

A control's radius never depends on its page.

### 2.4 Control heights

| Use              | Height                         |
| ---------------- | ------------------------------ |
| Nav bar          | 64px                           |
| Buttons/inputs   | 44px desktop, 48px primary CTA |
| Touch targets    | min 44×44px                    |
| Small nav button | 36px                           |

### 2.5 Type (self-hosted, zero CDN)

- **Display:** Space Grotesk Variable — headings, wordmark, ghost wordmark.
- **Body:** Inter Variable — everything else.
- **Mono:** IBM Plex Mono — shade codes, stats, fine print, data.

| Role           | Size           | Family/weight     | Tracking | Leading |
| -------------- | -------------- | ----------------- | -------- | ------- |
| Display (hero) | clamp(44→68px) | Grotesk 700       | −0.03em  | 1.01    |
| Page head      | clamp(36→52px) | Grotesk 700       | −0.02em  | 1.04    |
| Section head   | clamp(30→42px) | Grotesk 700       | −0.02em  | 1.06    |
| Card title     | 17–24px        | Grotesk/Inter 700 | −0.01em  | 1.3     |
| Body           | 15–17px fluid  | Inter 400         | −0.011em | 1.6     |
| Eyebrow/kicker | 11px uppercase | Inter 700         | +0.07em  | 1       |
| Data/mono      | 12–13px        | Plex Mono 400/500 | 0        | 1.5     |

Hierarchy is weight + size + color. Display heads use `text-balance`, ledes
use `text-pretty`. No italic display, no text-transform on body copy.

### 2.6 Shadows, materials & header

Shadow ladder (layered: contact + ambient), tokens in `globals.css`:

| Token             | Shape                                   | Use                               |
| ----------------- | --------------------------------------- | --------------------------------- |
| `--shadow-xs`     | `0 1px 2px` @ 6%                        | inputs, resting chips             |
| `--shadow-card`   | `0 1px 2px` + `0 10px 28px −8px`        | resting cards                     |
| `--shadow-float`  | `0 2px 6px` + `0 28px 56px −16px` @ 22% | hero panel, stat/CTA tiles, hover |
| `--shadow-button` | `0 8px 20px −8px` royal @ 55%           | primary / on-dark buttons         |

Materials:

- **Cards** rest on a hairline (`--line`) with `card-sheen` — a 1px sky
  catch-light along the top edge so white surfaces pick up the ambient
  light. Interactive cards lift −4px + `shadow-float` over 300ms.
- **Sticky header** is frosted glass: `bg-canvas/50–85` + `backdrop-blur` +
  `backdrop-saturate-150`; scrolled state adds the hairline + `shadow-xs`
  (owner call: blur header). A fixed header is the one sanctioned
  backdrop-blur; blur is never applied to elements that scroll with the page.
- **Floating panels** (shade-card miniature, stat tile, CTA tile) are
  `rounded-hero` with `shadow-float`; navy ones add `ks-aurora-dark`, a sky
  hairline across the top edge, and grain.
- **Forms**: focus = royal border + `0 0 0 3px rgb(30 58 138 / 0.12)` ring.

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

### 2.8 Product art — duotone (art-duotone / art-duotone-img)

Product photography is unified into the blue family: the art container is
royal (`art-duotone`) and the photo is grayscale, slightly brightened, and
`mix-blend-mode: multiply` (`art-duotone-img`). White product-shot
backgrounds therefore read as royal fields, and every card and product page
carries the same editorial treatment. Hover on card art: `scale(1.04)` over
500ms. Art never gets text overlays.

### 2.9 Buttons

| Variant | Style                                   | Use                      |
| ------- | --------------------------------------- | ------------------------ |
| primary | royal fill, white text, `shadow-button` | one per section on light |
| on-dark | sky fill, navy text, sky glow shadow    | one per section on navy  |
| ghost   | 1.5px currentColor border, transparent  | secondary                |
| link    | royal (light) / cornflower (dark), 600  | inline actions           |

Press: `scale(0.97)` on `:active`. Radius 11px, height per §2.4. Primary
hover deepens to navy with a stronger shadow; transitions 200ms.

## 3. Section grammar (page anatomy)

Pages are alternating bands, always in this visual order when present:

1. **Hero (light, home only):** `ks-aurora-light` + masked grid + grain;
   eyebrow glass pill, display head (navy, one royal emphasis line max),
   lede ink-soft, primary + ghost, mono fine-print line. Floating frosted
   panel on the right (shade-card miniature) with a small lot-note chip.
2. **Stats tile (navy, home only):** `rounded-hero` navy panel pulled up
   over the hero's lower edge (`-mt`), `ks-aurora-dark` + top sky hairline;
   2×2 mobile / 4-across desktop mono-labeled stats; numbers sky 28–30px
   Grotesk; cells lighten on hover.
3. **Index/cards (light, canvas-deep bg allowed):** kicker (hairline + royal
   text), section head, equal-height card grid via the shared `ProductCard`
   (duotone art, family chip row, spec ledger, hover lift).
4. **Process (navy full-bleed):** kicker sky, rows lift to `white/[0.04]`
   on hover with numbers waking from sky/50 to sky; 3 steps max per row.
5. **CTA tile:** `CtaPanel` — `rounded-hero` navy tile on canvas with
   aurora, grain, top sky hairline; left or centered; sky primary +
   cornflower ghost.
6. **Footer (navy):** compact 4-column grid — brand + trade summary +
   social glyphs, contact, desk hours, page index — ice-soft text,
   cornflower→sky links, mono © line, gradient ghost wordmark at the very
   bottom. Contact stays reachable from every page (business requirement).

Interior pages open with **PageHead**: the aurora band (masked grid) carrying
kicker, `h1` display, and lede; content continues in a plain `Section` below.

Rules: never two dark bands adjacent; never more than one primary button per
band; product data (yarn specs, shades) comes from `src/content/*`, never
hardcoded in components.

## 4. Motion grammar

Presets live with `src/components/motion/*` (Reveal) and the motion tokens
in `globals.css` — import/reference them, never re-derive. Eases:
`--ease-out = cubic-bezier(0.22,1,0.36,1)`, `--ease-spring =
cubic-bezier(0.34,1.45,0.5,1)` for small arrow/checkbox kicks, and the
cinematic pair `--ease-cinema` (600ms spring curve, sampled
`linear()`) + `--dur-cinema` for morphs and scroll entrances.

1. Enter = fade + 14px rise on `--ease-cinema` at `--dur-cinema`; siblings
   stagger 60–80ms, max 5.
2. Scroll reveals fire once, only above the fold edge; content is fully
   visible without JS.
3. **Load-in:** above-the-fold hero content enters once on page load with
   the same fade + rise (`ks-enter`, 760ms); siblings stagger 50–70ms.
   Pure CSS, runs before hydration, collapses under reduced motion.
4. Animate transform, translate, opacity, and shadow only. Never animate
   `filter` (e.g. blur crossfades) — it repaints per frame.
5. Hover language: cards −4px lift + `shadow-float` (300ms); art
   `scale(1.04)` (500ms); arrows translate 0.5–4px; nav links get a soft
   pill (`bg-navy/[0.04–0.07]`); active nav link is a royal-tinted pill.
6. No parallax, no looping backgrounds, no hover scale >1.04, no spinners —
   skeletons for async content.
7. `prefers-reduced-motion`: everything collapses to opacity ≤200ms.

### 4.2 Morph — pill ⇄ card

One surface grows from its collapsed row into the raised card and back on
the cinematic curve — the same element at both sizes, never a
close-then-open swap.

- FAQ accordion (`ui/accordion.tsx`): a closed item is a quiet row; open,
  it lifts into a card (radius chip→card, line border, white fill,
  shadow-xs). Surface, height keyframes and the rotating plus all ride
  `--ease-cinema` at `--dur-cinema`.
- Filterable grids (product index, shade explorer) glide via
  `src/lib/use-flip.ts` — survivors translate from their previous slot,
  entering items fade+rise 14px. No exit ghosts; transform/opacity only;
  no-JS and reduced motion never animate.
- Modal (mobile nav) slides and fades on the same curve.
- Small feedback (form success/error, hovers, arrows) keeps `--ease-out`
  — not everything is cinematic, only size and presence changes.

### 4.1 Scrolling rules

Scrolling is native — no JS scroll animator. CSS `scroll-behavior: smooth`
on `html` covers anchor jumps. Non-negotiables:

- Never mount a library that drives scroll per rAF frame (Lenis-style
  smooth scroll): it moves the page through fractional pixel offsets,
  which resamples text and images at subpixel positions every frame and
  reads as glitch/tearing on dpr-1 displays.
- `backdrop-blur` appears only on the fixed header and the modal overlay
  (both static while content moves beneath them) — never on elements that
  scroll with the page. The header carries a single filter pass (blur
  only, no saturate) to keep per-frame GPU cost inside the 6.9ms budget
  of a 144Hz display.
- Never gate rendering with `content-visibility` size estimates on
  scroll-traversed content: an estimate that differs from real height
  makes the page lurch as groups paint. The wound-yarn swatch grids
  scroll at full frame rate without it.

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
| Atmosphere utilities (`ks-*`)   | `src/app/globals.css`                          |
| Fonts (self-hosted WOFF2)       | `src/app/fonts/` + `@font-face` in globals.css |
| Brand/company facts             | `packages/shared` → `src/content/site.ts`      |
| Products/shades/markets content | `src/content/*`                                |
| Motion primitives               | `src/components/motion/*`                      |
| Layout chrome (header/footer)   | `src/components/layout/*`                      |
| Page head / CTA tiles           | `src/components/section/*`                     |
| Shared product card             | `src/components/products/ProductCard.tsx`      |

## 8. Agent checklist (before any UI change ships)

- [ ] Colors are tokens from §2.1 — no raw hex in components.
- [ ] Band order and anatomy match §3; one primary action per band.
- [ ] Radii/heights/spacing match §2.2–§2.4 — no new magic numbers.
- [ ] Type roles match §2.5; Grotesk only for headings, Plex Mono only for data.
- [ ] Motion per §4, reduced-motion honored, no spinners.
- [ ] `ks-*` atmosphere utilities never share a className with `bg-navy`
      (twMerge drops the color) — put them on separate elements.
- [ ] 44px targets + focus rings + contrast verified at mobile width.
- [ ] Would it print on the card without breaking §6? If not, rethink.
- [ ] Looks at home next to Luma / Linear / Apple marketing pages. If it reads
      as "bootstrap template", it is not done.
