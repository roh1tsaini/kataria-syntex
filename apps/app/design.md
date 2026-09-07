# design.md — apps/app design system (single source of truth)

> Apple (macOS/iOS) × Luma × shadcn/ui. One shape language, one spacing grid,
> one motion grammar. Every screen must look like the same product built by one
> hand. **If a value is not in this document, do not invent one — extend this
> document first (owner approves), then use it.**
>
> Applies to `apps/app` ONLY. `apps/web` has its own identity.
> Tokens live in `src/main/ui/globals.css` — code never hardcodes what a token
> already provides.

## 1. Principles

1. **Calm.** Nothing moves without a reason. Whitespace is the design.
2. **Consistent.** Same control = same shape, size, spacing, behavior,
   everywhere. A button in Settings and a button in Challans are identical.
3. **Physical.** Feedback on press (not release), springs over keyframes,
   interruptible motion, symmetric enter/exit paths.
4. **Legible.** Hierarchy from weight + size + color, never from decoration.
   Borders are hairlines; shadows are whispers.
5. **Respectful.** Reduced motion, reduced transparency, high contrast, safe
   areas, 44px touch targets — always on, never opt-in.
6. **Say it once.** One concept, one label per screen. A heading never
   repeats its field label; a tab never restates its panel title; helper
   text never echoes the label above it.
7. **No filler copy.** No taglines, no "portal / platform / solution"
   platitudes, no decorative subheads. Every word orients or instructs —
   otherwise delete it.
8. **Short, plain words.** Helper text is one short sentence, everyday
   English, no jargon. If it needs two sentences, rewrite it until it
   needs one.
9. **No jumps.** When swapped content changes the size, animate the size
   as well as the opacity — panels grow and shrink smoothly, never snap.

## 2. Foundations

### 2.1 Spacing grid — 4px base, never break it

| Token use                | Value                                     |
| ------------------------ | ----------------------------------------- |
| Inline gaps (icons↔text) | `gap-1.5` (6px) / `gap-2` (8px)           |
| Control padding-x        | 12px (`px-3`) / 16px (`px-4`)             |
| Card padding             | 16px (`p-4`) standard, 20px (`p-5`) roomy |
| Between related fields   | 12–16px (`space-y-3`/`4`)                 |
| Section spacing          | 24px (`gap-6`/`space-y-6`)                |
| Page gutter              | 16px mobile, 24px ≥sm, 32px ≥xl           |
| Grid gaps                | 12px mobile, 16px desktop                 |

Rules: related items 8–12px apart, groups 16–24px apart, sections 24–32px.
Never mix two spacings for the same relationship on one screen.

### 2.2 Radius ladder (one family, continuous feel)

Base `--radius: 0.625rem` (10px):

| Token             | Value | Used for                               |
| ----------------- | ----- | -------------------------------------- |
| `rounded-sm`      | 8px   | badges, chips, small tags              |
| `rounded-md`/base | 10px  | buttons, inputs, selects, toggles      |
| `rounded-lg`      | 12px  | cards, filter bars, table containers   |
| `rounded-xl`      | 16px  | dialogs, popovers, dropdowns           |
| `rounded-2xl`     | 20px  | bottom sheets (mobile drawers/dialogs) |

Pills (`rounded-full`) only for avatar/badge dots and icon-button circles /
capsules (§2.7). **A control's radius never depends on its page.**

### 2.3 Control heights (one ladder, everywhere)

| Size      | Height   | Use                                       |
| --------- | -------- | ----------------------------------------- |
| `sm`      | 32px     | dense tables, toolbar clusters            |
| `default` | 40px     | all standard buttons/inputs on desktop    |
| touch     | min 44px | every tappable element on coarse pointers |
| `lg`      | 44–48px  | primary CTAs on mobile, auth forms        |

Buttons, inputs, selects, date pickers in one row MUST share one height.
Icon-only buttons are squares of the same height.

### 2.4 Type scale (Inter Variable, optical sizing on)

Tracking tightens as size grows; leading does the opposite.

| Role          | Size                 | Weight | Tracking | Leading      |
| ------------- | -------------------- | ------ | -------- | ------------ |
| Page title    | clamp 28→36px        | 700    | −0.022em | 1.05         |
| Section head  | 15–17px              | 600    | −0.01em  | 1.3          |
| Body          | 1rem (15–17px fluid) | 400    | −0.011em | 1.6          |
| Small/meta    | 13px                 | 500    | 0        | 1.4          |
| Eyebrow/label | 11px uppercase       | 600    | +0.06em  | 1            |
| Data/numbers  | inherits             | 500+   | —        | tabular-nums |

Page totals use the page-title size; section totals use the section-head
size. Pairing codes keep wide tracking (+0.18em) with tabular-nums as the
one legibility exception.

Hierarchy is weight+size+color. No italic, no underlines except links,
no text-transform on body copy.

### 2.4.1 Print & PDF (Inter, bundled, one template)

- Every print surface — server PDF, desktop PDF, on-screen print view —
  renders in Inter Regular/Bold (OFL) bundled from `src/shared/fonts/`,
  inlined as base64 `@font-face`. No CDN, no system-font fallback, anywhere.
- One source of truth: `src/shared/challan-html.ts` emits the sheet markup;
  all three surfaces render exactly that HTML. They must stay visually
  identical.
- The challan sheet is A5 landscape (210×148 mm): centered masthead
  (doc title · company name/address/contact · ORIGINAL/DUPLICATE checkboxes),
  bordered party band with a challan-no/date cell, black table header over 12
  ruled rows, totals zone (GSTIN/PAN/remarks left, totals right), terms +
  signature footer. Fixed-height zones — dynamic text wraps or ellipsizes,
  never pushes later zones off the sheet.
- Grayscale-safe palette (black ink, gray labels, hairline rules) — challans
  print on mono printers; color carries no meaning.
- Restyles are staged as finished directions in `design-compare/` (see its
  README): ten challan-sheet (A–J), ten carton-sticker (S-A–S-J) and ten
  sales-report (R1–R10) directions — pending owner picks; the live templates
  don't change until then.

### 2.5 Color & surfaces

- Semantic tokens only (`bg-card`, `text-muted-foreground`, …) — never raw
  oklch in components. Accents flow through `--a-*` (picker in Settings).
- Surface hierarchy: `background` (window) < `card` (content) < `popover`
  (floating). Light mode: slightly recessed window, white cards. Dark:
  elevated cards on near-black. Never invert the hierarchy.
- Status colors: `success` / `warning` / `destructive` — used for state,
  never decoration. Status badges: soft tint (`--a-soft`-style 10–15% alpha)
  - ink text, no solid pills in tables.
- Borders: 1px `--border` hairlines. Dark mode borders are white @10%, not
  gray. Hover states shift border/background subtly — never both loudly.

### 2.6 Shadows & materials

- `--shadow-soft` (rest) → `--shadow-lift` (hover) → `--shadow-overlay`
  (floating). `--shadow-lift` is `0 4px 12px -4px oklch(0 0 0 / 10%),
0 2px 6px -2px oklch(0 0 0 / 6%)`.
  Cards rest flat with hairline borders; lift max −1px on hover.
- Floating chrome (app header, mobile tab bar, sticky action bars): translucent
  `color-mix` background + `backdrop-blur` + hairline edge. Content scrolls
  under it. `prefers-reduced-transparency` falls back to solid.

### 2.7 Icon buttons & capsules (shell chrome)

New-Apple (iOS 26 / macOS Tahoe) control grammar: hardware curvature informs
controls, and actions that sit together share one grouped background.

- **One lone small icon button = a circle.** `rounded-full`, hairline border,
  transparent at rest, `bg-muted` on hover, press `scale(0.9)`. Size 32px on
  desktop, 44px (`touch`) on coarse pointers.
- **Two or more adjacent icon buttons = one capsule.** `rounded-full`
  container, `bg-muted/60`, `p-1`, `gap-1`; every button inside stays a
  circle. Vertical stacks (icon rail) use a vertical capsule.
- Never mix a circle and a squared button in one cluster. Nav selection rows
  (sidebar items, rail items, tab bar) keep `rounded-md` — circles are for
  actions, not navigation.
- Applies on desktop AND mobile, everywhere in the shell (sidebar toggle,
  drawer close, footer theme/logout, header accent).
- Primitive: `ui/circle-button.tsx` — `CircleButton`, `ButtonCapsule`.
- Content icon tiles: `size-10 rounded-lg bg-muted text-muted-foreground`
  with a `size-5` icon. One treatment everywhere.

### 2.7.1 Window chrome — Electron desktop (custom title bar)

Frameless window, app-drawn chrome like modern Electron apps (Spotify,
Discord). The system bar never appears on any platform.

- Bar: `h-9` (2.25rem), full width, `bg-background`, no border, `select-none`,
  entirely `-webkit-app-region: drag`. Double-click on a drag region toggles
  maximize natively (HTCAPTION).
- Controls (Windows/Linux only): three `w-12` no-drag buttons, right-aligned,
  stretched to the bar height. Glyphs are 10px inline SVG strokes (minimize,
  maximize/restore, close) — never icon-font glyphs. Rest:
  `text-muted-foreground`; hover: `bg-muted` + `text-foreground`; close
  hover: `bg-destructive text-destructive-foreground`. Focus ring per §6.
- macOS: no drawn controls — native traffic lights ride the strip
  (`titleBarStyle: hiddenInset`), bar stays drag-only.
- Desktop shell scroll model: `<html data-shell="desktop">` (set by the
  entry before first paint, together with `--titlebar-h: 2.25rem`) pins the
  document (`overflow: hidden`, `#root` a full-height flex column). The bar
  is a sticky-pinned strip (`sticky top-0`) at the top; routed content scrolls
  inside `.app-scroll` (`flex-1 overflow-y-auto` under the bar), so the window
  controls sit flush against the window edge — the root scrollbar can never
  inset them, and the bar never scrolls away. The shell resets the viewport
  `scrollbar-gutter` to `auto` — `stable` would reserve a gutter even with
  document scrolling disabled, insetting the bar from the window edge.
- Height reservation: `--titlebar-h` (0px default; the entry sets 2.25rem on
  `document.documentElement` before first paint when `window.desktop`
  exists). Root containers use
  `min-h-[calc(100dvh-var(--titlebar-h))]` — never hardcode `min-h-dvh`
  alone. Print forces the variable back to 0 and restores document flow
  (multi-page print), and the bar itself is `print:hidden`.
- Web/PWA and Capacitor render nothing. The only window-control IPC path is
  `platform.ts` → `desktopWindow()`; UI never calls `window.desktop`
  directly.

### 2.8 App identity (names — never invent variants)

| Form  | Value                    | Used for                                                                                                                            |
| ----- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Short | `KS Biz App`             | sidebar header, compact chrome                                                                                                      |
| Full  | `Kataria Syntex Biz App` | document `<title>`, PWA manifest `name`, installer/product names (Electron, Capacitor, Android strings), auth header, release names |
| Never | `Kataria Challan` etc.   | — (does not exist)                                                                                                                  |

`Kataria Syntex` alone is the company/workspace name (sidebar subtitle,
placeholders, fallbacks) — never the app name.

## 3. Component specs (ui/*)

| Component                        | Contract                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button                           | Radii/heights from §2.2/§2.3. Press: `scale(0.97)` @100ms on `:active`. Variants: `default` (foreground fill), `accent` (primary), `secondary`, `outline`, `ghost`, `destructive`, `link`. Max one `default`/`accent` per cluster; destructive always confirm-gated.                                                                                       |
| CircleButton / ButtonCapsule     | Shell-chrome icon actions (§2.7). Lone = circle 32px (44px touch), hairline border, press `scale(0.9)`. Adjacent pairs join in a `ButtonCapsule` (`bg-muted/60`, `p-1`, `gap-1`, vertical variant for the rail). Never for navigation rows.                                                                                                                |
| Input/Select/Textarea/DatePicker | Height 40px, radius 10px, 1px border, focus = border-color goes accent (`--ring`) and nothing else: no `box-shadow` halo, no `outline`. The focus override lives in `@layer utilities` — a components-layer rule loses to the `border-input` utility regardless of specificity. Label 13px medium above, helper/error 12px below, `aria-invalid` on error. |
| Card                             | radius 12px, hairline border, padding 16/20px, no shadow at rest. Hover lift only for interactive cards.                                                                                                                                                                                                                                                   |
| Dialog                           | Desktop: centered, radius 16px, overlay scrim 40% + 4px backdrop blur, enter = fade + scale 0.96→1 + slight y. Mobile (≤sm): bottom sheet, radius 20px top, drag-to-dismiss. Exit mirrors entry exactly.                                                                                                                                                   |
| Dropdown/Popover                 | Anchored to trigger, scale from the trigger edge (transform-origin), fade + scale 0.97→1, ≤180ms. Items 36px tall, radius 8px inset.                                                                                                                                                                                                                       |
| Tabs                             | Underline indicator that slides (layout animation), not cross-fade swaps. 40px tall, labels 13–15px medium.                                                                                                                                                                                                                                                |
| Badge                            | 11px semibold, radius 8px, soft tint + ink in tables; solid fills stay outside tables. Heights unified at 20/22px.                                                                                                                                                                                                                                         |
| Toast                            | Bottom-center stack, radius 12px, overlay shadow, auto-dismiss, one line: title only, no restating description.                                                                                                                                                                                                                                            |
| Empty states                     | Centered, icon 40px muted, title 15px semibold, one-line description, one action. No illustrations.                                                                                                                                                                                                                                                        |
| Skeletons                        | Same shape/size as the loaded content, `animate-pulse` muted. Spinners are banned.                                                                                                                                                                                                                                                                         |
| Tables                           | Container card radius 12px; header row 11px uppercase muted; rows 44px (touch) / 40px desktop; hover muted bg 140ms; numbers tabular + right-aligned.                                                                                                                                                                                                      |

## 4. Layout

- Content max width: 1200px for data pages, 640px for forms/auth.
- Page structure is always: `PageHeader` (title + desc + actions) → optional
  filter bar → content. Eyebrow, title, and description never repeat the
  same concept. One primary action top-right; secondary inside.
- Mobile: single column, cards; ≥sm: grids (`minmax(0,1fr)`); ≥xl: data grids
  up to 4 columns. Card grids keep equal heights (`grid` + stretch).
- Mobile nav: bottom tab bar (translucent material, safe-area padding) for
  the four primary destinations, plus a **full-screen nav sheet** for
  everything else. Desktop: left sidebar. Same items, same order, same icons
  on all three surfaces.
- Full-screen nav sheet (opens from the header avatar / "More" tab): covers
  the viewport (`inset-0`, `bg-background`), slides from the left 280ms
  `EASE_DRAWER`, exits 20% faster, no scrim (nothing remains visible to tap).
  Closed by X, Escape or navigation. Layout top→bottom: brand title
  (`text-2xl`, 700, −0.022em, "KS Biz App") with workspace + role line, a
  capsule of touch circles (accent picker, close) top-right, an FY + sync
  status strip (hairline border, `bg-card`, tap opens sync), the roomy nav
  list, and a pinned footer: identity (avatar 36px + name + workspace) left,
  one primary action (`New challan`, accent) right. Nav rows in the sheet use
  the roomy ladder: `min-h-12`, 15px labels, `size-5` icons, `gap-3`,
  `rounded-md` selection (never circles), subs `min-h-11`/13px under an
  `ml-5` rule. Reduced-motion collapses to opacity.
- A collapsed sidebar expands on hover as an overlay — the page underneath
  never moves. Opening waits ~120ms of hover intent; closing waits ~180ms
  after the pointer leaves.
- A parent item with sub-items is a toggle, never a selection: it never
  takes the accent pill, even when one of its subs is active. The active
  sub alone takes the pill; the parent renders `font-medium
text-foreground` while a sub is active. The collapsed rail keeps the
  pill on the parent icon (its subs aren't visible there).
- Every screen answers: Where am I? (header) Where can I go? (nav)
  How do I get out? (back/close) — wayfinding is never optional.

## 5. Motion grammar

Presets live in `src/main/ui/lib/motion.ts` — import them, never re-derive.

| Preset          | Value                                             | Use                                   |
| --------------- | ------------------------------------------------- | ------------------------------------- |
| `EASE_OUT`      | `cubic-bezier(0.16,1,0.3,1)`                      | all enter/exit tweens                 |
| `EASE_IN_OUT`   | `cubic-bezier(0.65,0,0.35,1)`                     | symmetric repositions                 |
| `EASE_DRAWER`   | `cubic-bezier(0.32,0.72,0,1)`                     | sheets/drawers                        |
| `SPRING`        | spring, bounce 0, 0.38s                           | default for anything touchable        |
| `DRAWER_SPRING` | spring, bounce 0.12, 0.36s                        | ONLY momentum-driven (flicked sheets) |
| Durations       | 120 press / 140 fast / 200 base / ≤400ms anything | —                                     |

Rules:

1. **Animate transform + opacity only.** Never width/height/top/left/margin.
   Size changes use `grid-template-rows` animation, never `height` tweens.
   One exception: the desktop app rail may tween `width` (200ms
   `EASE_DRAWER`) when it expands on hover.
2. **Enter and exit are the same path reversed.** Slide in from right → dismiss
   to right. Exits are ~20% faster than entries.
3. **Origins anchor to the trigger.** Popovers grow from their button.
4. **Bounce only after momentum.** Menus, dialogs, fades: bounce 0. Flicked
   sheets: ≤0.12. Nothing else.
5. **Choreography:** stagger siblings 40ms (max ~5 items staggered), page
   entrance = fade + 4–6px rise ≤240ms. No parallax, no looping animations,
   no hover scale >1, no emoji/confetti.
6. **Press feedback is instant** (`:active` or pointer-down), 100ms, scale
   0.97 on controls, background tint on list rows.
7. **Interruptibility:** anything a user can grab uses springs (motion/react);
   re-target from current value, carry velocity.
8. **When in doubt, don't animate.** Motion earns its place by explaining
   where things came from or where they went.
9. `prefers-reduced-motion`: everything collapses to ≤200ms opacity cross-fades
   (handled centrally in globals.css + `useReducedMotion()` in components).

## 6. Accessibility floor (non-negotiable)

- 44×44px touch targets on coarse pointers; dense 32/40px sizes stay on
  desktop. Visible focus ring (2px accent, 2px offset) alongside the
  hairline brighten;
  `aria-invalid` + inline error text; labels on every input (no placeholder-
  only labels); contrast ≥ 4.5:1 body / 3:1 large; safe-area insets honored;
  `tabular-nums` for anything numeric that updates.

## 7. Codebase map (where things live)

| Concern                                 | File                                          |
| --------------------------------------- | --------------------------------------------- |
| Tokens (color/radius/shadow/ease)       | `src/main/ui/globals.css`                     |
| Motion presets                          | `src/main/ui/lib/motion.ts`                   |
| Reveal/Stagger/Skeleton/PageTransition  | `src/main/ui/components/motion.tsx`           |
| Primitives (shadcn-style)               | `src/main/ui/components/ui/*`                 |
| Circular icon buttons & capsules (§2.7) | `src/main/ui/components/ui/circle-button.tsx` |
| App frame (sidebar/tab bar/header)      | `src/main/ui/components/app-shell.tsx`        |
| Page scaffold                           | `src/main/ui/components/page-header.tsx`      |
| Error-code → human copy                 | `src/main/ui/lib/errors.ts`                   |

## 8. Agent checklist (before any UI change ships)

- [ ] Radii/heights/spacing match §2 — no new magic numbers.
- [ ] Same-height, same-radius controls within each row/cluster.
- [ ] One primary action per screen region; destructive gated by confirm.
- [ ] Loading = skeletons shaped like the content; empty = Empty pattern.
- [ ] Motion uses presets, honors reduced-motion, exits mirror entries.
- [ ] Dark mode checked (tokens only — no raw colors).
- [ ] 44px targets + focus rings + labels verified on the mobile breakpoint.
- [ ] Looks at home next to macOS System Settings / Linear / Luma. If it reads
      as "admin template", it is not done.
- [ ] This document updated in the same change (§9).

## 9. Keeping this document current

This document is a living contract, not a snapshot. After every UI
change, in the same change:

1. If you used a value or pattern this document doesn't define, add it
   here first (owner approves), then use it.
2. If a change made any section above untrue, rewrite that section to
   describe what IS now — current state only, no history narration.
3. If code and this document disagree, the mismatch ships fixed in the
   same change, never deferred.
