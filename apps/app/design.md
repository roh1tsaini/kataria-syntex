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

Hierarchy is weight+size+color. No italic, no underlines except links,
no text-transform on body copy.

### 2.4.1 Print & PDF (Inter, bundled, one geometry)

- Every print surface — server PDF, offline PDF, browser print replica —
  renders in Inter Regular/Bold (OFL) bundled from `src/shared/fonts/`.
  No CDN, no system-font fallback, anywhere.
- One geometry source of truth: `src/shared/pdf-template.ts`. Both PDF
  renderers and the CSS replica consume the same constants; they must stay
  visually identical.
- Grayscale-safe palette (black ink, gray labels, hairline rules) — challans
  print on mono printers; color carries no meaning.

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
  (floating). Cards rest flat with hairline borders; lift max −1px on hover.
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

## 3. Component specs (ui/*)

| Component                        | Contract                                                                                                                                                                                                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button                           | Radii/heights from §2.2/§2.3. Press: `scale(0.97)` @100ms on `:active`. Variants: `default` (foreground fill), `accent` (primary), `secondary`, `outline`, `ghost`, `destructive`, `link`. Max one `default`/`accent` per cluster; destructive always confirm-gated. |
| CircleButton / ButtonCapsule     | Shell-chrome icon actions (§2.7). Lone = circle 32px (44px touch), hairline border, press `scale(0.9)`. Adjacent pairs join in a `ButtonCapsule` (`bg-muted/60`, `p-1`, `gap-1`, vertical variant for the rail). Never for navigation rows.                          |
| Input/Select/Textarea/DatePicker | Height 40px, radius 10px, 1px border, focus = the hairline border brightens 40% toward foreground; no glow, no outline stacking (never layout shift). Label 13px medium above, helper/error 12px below, `aria-invalid` on error.                                     |
| Card                             | radius 12px, hairline border, padding 16/20px, no shadow at rest. Hover lift only for interactive cards.                                                                                                                                                             |
| Dialog                           | Desktop: centered, radius 16px, overlay scrim 40% + 4px backdrop blur, enter = fade + scale 0.96→1 + slight y. Mobile (≤sm): bottom sheet, radius 20px top, drag-to-dismiss. Exit mirrors entry exactly.                                                             |
| Dropdown/Popover                 | Anchored to trigger, scale from the trigger edge (transform-origin), fade + scale 0.97→1, ≤180ms. Items 36px tall, radius 8px inset.                                                                                                                                 |
| Tabs                             | Underline indicator that slides (layout animation), not cross-fade swaps. 40px tall, labels 13–15px medium.                                                                                                                                                          |
| Badge                            | 11px semibold, radius 8px, soft tint + ink; heights unified at 20/22px.                                                                                                                                                                                              |
| Toast                            | Bottom-center stack, radius 12px, overlay shadow, auto-dismiss, one-line copy.                                                                                                                                                                                       |
| Empty states                     | Centered, icon 40px muted, title 15px semibold, one-line description, one action. No illustrations.                                                                                                                                                                  |
| Skeletons                        | Same shape/size as the loaded content, `animate-pulse` muted. Spinners are banned.                                                                                                                                                                                   |
| Tables                           | Container card radius 12px; header row 11px uppercase muted; rows 44px (touch) / 40px desktop; hover muted bg 140ms; numbers tabular + right-aligned.                                                                                                                |

## 4. Layout

- Content max width: 1200px for data pages, 640px for forms/auth.
- Page structure is always: `PageHeader` (title + desc + actions) → optional
  filter bar → content. One primary action top-right; secondary inside.
- Mobile: single column, cards; ≥sm: grids (`minmax(0,1fr)`); ≥xl: data grids
  up to 4 columns. Card grids keep equal heights (`grid` + stretch).
- Mobile nav: bottom tab bar (translucent material, safe-area padding).
  Desktop: left sidebar. Same items, same order, same icons on both.
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

- 44×44px touch targets; visible focus ring (2px accent, 2px offset);
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
