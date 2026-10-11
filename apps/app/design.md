# design.md — apps/app design system (single source of truth)

> Apple (macOS/iOS) × Luma × shadcn/ui. One shape language, one spacing grid,
> one motion grammar. Every screen must look like the same product built by one
> hand. **If a value is not in this document, do not invent one — extend this
> document first (owner approves), then use it.**
>
> Applies to `apps/app` ONLY. `apps/web` has its own identity.
> Tokens live in `src/main/ui/globals.css` — code never hardcodes what a token
> already provides.
>
> The Android app (`apps/android`) implements this same design language by
> loading the same web bundle in a Capacitor WebView at the `≤sm` breakpoint.
> There is no separate Android token set or primitives — the rendering is the
> web rendering. This document stays the single source of truth for every
> visual value on every shell.

Contents: 1 Principles · 2 Foundations (2.1 spacing, 2.2 radius, 2.3
control heights, 2.4 type, 2.4.1 dates & numbers, 2.5
color, 2.6 shadows, 2.7 icon buttons, 2.7.1 window chrome, 2.7.2 floating
phone navigation, 2.8 app identity) · 3 Components · 3.1 skeletons · 3.2
notification toast · 3.3 update surfaces · 3.4 download page · 4 Layout
(4.1 Android shell) ·
5 Motion (5.1 overlay surfaces) · 6 Accessibility · 7 Codebase map · 8 Checklist ·
9 Currency.

## 1. Principles

1. **Calm.** Nothing moves without a reason. Whitespace is the design.
2. **Consistent.** Same control = same shape, size, spacing, behavior,
   everywhere. A button in Settings and a button in Devices are identical.
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
| `rounded-md`/base | 10px  | inputs, navigation rows                |
| `rounded-lg`      | 12px  | cards, filter bars, table containers   |
| `rounded-xl`      | 16px  | dialogs, overlay windows               |
| `rounded-2xl`     | 20px  | bottom sheets (mobile drawers/dialogs) |

`rounded-full` is for avatars/dots, text-action pills, segmented controls,
and icon-button circles/capsules (Section 2.7). Inputs and cards retain the
ladder above. **A control's radius never depends on its page.**

### 2.3 Control heights (one ladder, everywhere)

| Control  | Height   | Use                                       |
| -------- | -------- | ----------------------------------------- |
| Standard | 40px     | all buttons and inputs on desktop         |
| Mobile   | 44px     | buttons and inputs below `sm`             |
| Touch    | min 44px | every tappable element on coarse pointers |

Every button uses one size, radius, and press response. Inputs in one row
share the same height. Icon-only buttons are squares or circles at that height.

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

Form labels (`FieldLabel` in `ui/components/ui/field.tsx`) follow the
Small/meta standard: 13px, weight 500 (`text-[13px] font-medium leading-snug`).

Page totals use the page-title size; section totals use the section-head
size. Pairing codes keep wide tracking (+0.18em) with tabular-nums as the
one legibility exception.

Hierarchy is weight+size+color. No italic, no underlines except links,
no text-transform on body copy.

### 2.4.1 Dates & numbers

- Dates render `DD Mon YYYY` (`03 Sep 2026`) via `fmtDate` (`ui/lib/format.ts`),
  parsed timezone-safe: date-only strings build from parts, never UTC.
- Fresh timestamps render relative through `fmtRelative` (`ui/lib/format.ts`):
  "Active now", "12 min ago", "3 hr ago", "Yesterday" — anything older falls
  back to `fmtDate`. Same single home, one wording everywhere.
- Numbers that update render as static text with `tabular-nums`; there is no
  animated counter. Under `prefers-reduced-motion` nothing animates anyway.

### 2.5 Color & surfaces

- Semantic tokens only (`bg-card`, `text-muted-foreground`, …) — never raw
  oklch in components. One neutral monochrome accent flows through `--a-*`
  — no picker or hue.
- Surface hierarchy: `background` (window) < `card` (content). Light mode:
  slightly recessed window, white cards. Dark: elevated cards on
  near-black. Never invert the hierarchy.
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
- Floating chrome (app header, sticky action bars): translucent
  `color-mix` background + `backdrop-blur` + hairline edge. Content scrolls
  under it. The header sits on the page background (`bg-background/85`,
  `bg-background/70` where backdrop-filter is supported), never `bg-card` —
  one flat wash, no double surface against the sidebar's card.
  `prefers-reduced-transparency` falls back to solid.
- Frosted glass & blur surfaces:
  - Header chrome: `backdrop-blur-xl bg-background/85 supports-[backdrop-filter]:bg-background/70`
  - Floating capsule / circle navigation: `capsule-surface` / `menu-float-circle` with `backdrop-filter: blur(12px) saturate(1.4)` and `color-mix(in oklch, var(--card) 78%, transparent)`
  - Sticky mobile action bars (`.sticky-action-bar`): `backdrop-filter: blur(12px) saturate(1.4)` and `color-mix(in oklch, var(--card) 85%, transparent)`
  - Dialog & settings scrims: `bg-black/40 backdrop-blur-[4px]`
  - Under `prefers-reduced-transparency: reduce`, all frosted glass surfaces collapse to solid background/card fills and remove backdrop filters.
- Header right side: the company name is bare muted text — no bordered
  chips, no boxed backgrounds in the chrome row.

### 2.7 Icon buttons & capsules (app-wide)

New-Apple (iOS 26 / macOS Tahoe) control grammar: hardware curvature informs
controls, and actions that sit together share one grouped background.

- **One lone icon-only button = a circle.** `rounded-full`, hairline border,
  transparent at rest, `bg-muted` on hover and on `:active` press (touch has
  no hover — the active fill is the press feedback), press `scale(0.97)`.
  The OS tap highlight is transparent globally (`globals.css`) — it paints a
  square over the bounding box and ignores the circle. Size 40px on desktop,
  44px below `sm` and on coarse pointers.
- **Two or more adjacent icon buttons = one capsule.** `rounded-full`
  container, `bg-muted/60`, `p-1`, `gap-1`; every button inside stays a
  circle. Vertical action stacks use a vertical capsule; navigation rail
  items remain separate square links.
- Never mix a circle and a squared button in one cluster. Nav selection rows
  (sidebar items, drawer items, settings items) use the shared `.app-nav-row`
  sizing and keep `rounded-md`; icon rail items are square at the same height.
  Circles are for actions, not navigation.
- Applies across desktop and mobile: shell actions, page actions, form row
  actions and dialog close controls. Text action buttons are capsules; icon
  actions have equal width and height. Inputs and cards keep their radius
  ladder.
- Capsules have a static top highlight (`--specular`: white 55% in light,
  8% in dark). Related actions share a muted background with 4px inset/gap;
  direct child buttons and links inside have no individual border. When a
  responsive cluster becomes separate desktop text buttons, outline links
  restore their individual borders at that breakpoint.

### 2.7.1 Window chrome — Electron desktop (blended, no bar)

Frameless window, blended app-drawn chrome like Claude/VS Code: there is no
title bar — the app surface runs to every window edge. The system bar never
appears on any platform.

- Layout: the sidebar is full window height (its brand row is the window's
  top-left corner); the header is the full-height content column's top row
  (desktop only — below `md` there is no header bar, just a `panel-left`
  circle fixed at the top-left over content with 16px padding plus the
  status-bar inset, so page content needs `pt-16` clearance). Their `h-14`
  bottom borders form one continuous line across the window.
  On phones with a status-bar inset the header grows by
  `env(safe-area-inset-top)` (inline height, paddingTop inset) so the
  content box stays 56px — padding alone would shrink it under border-box
  and push touch targets over the hairline.
- Drag regions — one rule: **the drag strip is the first element in the app
  root, and every other app-region surface is a descendant of it or a later
  sibling.** A `drag` rect swallows every pointer event inside it (the OS,
  not the page, takes the click), and rects resolve last-wins in layout-tree
  order with z-index ignored, so that single position is what makes every
  control clickable:
  - `ChromeDragStrip`: the one invisible fixed strip (`h-14`, `z-20`) across
    the top, rendered first in App. Its free space moves the window;
    double-click toggles maximize via HTCAPTION.
  - Owned bands: the header row and the sidebar brand row are `drag` as well,
    so the band reads as one continuous title area on shell routes (the
    sidebar's brand text drags; its `panel-left` toggle is a nested `no-drag`
    island). The rest of the sidebar carries no app-region at all.
  - Subtractions: the header's right text stack and the settings window are
    `no-drag` islands/siblings collected after the
    strip. `dragStyle`/`noDragStyle` (`title-bar.tsx`) are the only definitions
    — no surface keeps a private copy.
  - Belt: inside `[data-shell="desktop"]` every control (`button`, `a[href]`,
    `input`, `select`, `textarea`, `label`, `summary`, `[role=button]`,
    `[role=tab]`, `[contenteditable="true"]`) is `no-drag`, so a new control
    is clickable without anyone remembering the rule.
- Controls (Windows/Linux): a floating cluster pinned flush into the
  top-right corner (`fixed top-0 right-0`, `h-14`, `z-[60]`) — three
  `--wc-btn-w` no-drag buttons stretched to full header height. Glyphs are
  lucide at 14px (`Minus`, `Square`/`Copy`, `X`) — inline SVG, never an icon
  font. Rest: `text-muted-foreground`; hover: `bg-foreground/10` +
  `text-foreground`; close hover: `#e81123` + white, full bleed into the
  corner (no gap — the corner click must land).
- Reservation: `--wc-w` (3 × `--wc-btn-w`, set on `documentElement` by the
  entry before first paint when `window.desktop` exists and platform
  ≠ darwin; 0px otherwise). `--wc-btn-w` is `2.5rem`, `2.75rem`
  under `pointer: coarse` — the 44px floor widens the controls, and the
  reservation has to widen with them. The header reserves it via
  `pr-[calc(1rem+var(--wc-w))]` / `sm:pr-[calc(1.5rem+var(--wc-w))]` so
  content never slides beneath the controls.
- macOS: no drawn controls — native traffic lights ride the sidebar's
  top-left (`titleBarStyle: hiddenInset`). The entry sets `--tl-inset:
2.25rem` on darwin; the sidebar carries `pt-[var(--tl-inset)]` so the
  brand row clears the lights.
- Desktop shell scroll model: `<html data-shell="desktop">` (set by the
  entry before first paint) pins the document (`overflow: hidden`, `#root`
  a full-height flex column). Shell routes scroll in `.shell-scroll` — a
  scroller inside the content column that starts _below_ the header row —
  so the page scrollbar begins under the header line, never beside the
  window controls; the header, sync banner and sidebar never scroll.
  Chrome-less routes (no shell) scroll in `.app-scroll` (the `#root`
  flex-1 wrapper). The shell resets the viewport `scrollbar-gutter` to
  `auto` — `stable` would reserve a gutter even with document scrolling
  disabled.
- Chrome-less routes: on the full-height sidebar breakpoint they show no
  header; the drag strip + the floating controls still cover dragging and
  window management over the bare page.
- Web renders nothing (no strip, no controls, no reservation —
  `--wc-w`/`--tl-inset` stay 0px); the title bar is an Electron-only
  surface. The Android app draws its own native shell in the same grammar
  at phone scale (Section 4.1) and the sidebar toggle is the same
  `panel-left` icon on every shell. The only window-control IPC path is
  `platform.ts` → `desktopWindow()`; UI never calls `window.desktop`
  directly.
- Desktop-native behaviour: the window restores its last size, position and
  maximized state (validated against the connected displays), the shell paints
  its background in the user's resolved theme before the bundle boots, and
  editable fields get the standard copy/paste context menu.
  While a large overlay surface is open (the settings window), the floating
  window controls stay sharp and clickable above its scrim — they are chrome
  above content, never dimmed by an in-app surface.
- Layering order: shell header `z-30`, sidebar `z-40`, large overlay surfaces
  (settings window) `z-[45]`, every `Dialog`/sheet `z-50`, and the floating
  window controls `z-[60]`. An overlay that dims the app must never dim the
  OS window controls, and a confirm/update dialog must always sit above the
  settings window.

### 2.7.2 Floating phone navigation

- Below `md`, a centered capsule holds the primary shortcuts (`Home`,
  `Connected Devices`) plus More. More opens the full navigation drawer and
  stays available for account actions. With no shortcuts, More is a single
  circle. Shortcuts stay in the same order across routes; the drawer holds
  every destination.
- Every item is a 44px circle with a 20px icon and an accessible name.
  Active fill moves using the shared `SPRING` layout transition; selected
  icons use a 260ms 0.82→1.14→1 pulse on selection, not on initial mount.
  Reduced motion uses a static selection and no icon pulse.
- Surface: 4px inset, 12px bottom clearance plus safe area, card 78% opacity,
  static 12px backdrop blur with 1.4 saturation, hairline border and overlay
  shadow. Unsupported/reduced-transparency environments use a solid card.
  Never animate blur or run an idle animation loop.
- Content keeps its `pb-28` reservation below `md`. Mobile sticky actions sit
  above the navigation footprint: `3.25rem` (item plus capsule inset), 2px
  border, 12px bottom clearance and the bottom safe area. Their own padding
  is 12px vertically and 16px horizontally; the safe area is counted only in
  the bottom offset. This reservation stays stable while editing, so focus
  changes do not move the actions. At `sm` and above, actions remain in flow.
- The bar is hidden while the navigation drawer is open and while editing a
  field. Native window controls retain their platform edge-click behavior.
- Primitive: `src/main/ui/components/ui/circle-button.tsx` — `CircleButton`,
  `ButtonCapsule`.
- Content icon tiles use `.content-icon-tile`: 40px, 12px radius, muted surface
  and text, with a 20px icon. Status tiles keep the same geometry and use
  semantic surface and text tokens.

### 2.8 App identity (names — never invent variants)

| Form  | Value                    | Used for                                                                                            |
| ----- | ------------------------ | --------------------------------------------------------------------------------------------------- |
| Short | `KS Biz App`             | sidebar header, compact chrome                                                                      |
| Full  | `Kataria Syntex Biz App` | document `<title>`, installer/product names (Electron, Android strings), auth header, release names |
| Never | `Kataria Challan` etc.   | — (does not exist)                                                                                  |

`Kataria Syntex` alone is the company name (sidebar subtitle,
placeholders, fallbacks) — never the app name.

## 3. Component specs (ui/*)

| Component                                               | Contract                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button                                                  | One shared size: 40px desktop, 44px below `sm` and on coarse pointers. Radii from Section 2.2. Press: `scale(0.97)` @100ms on `:active` via `.btn-motion`. Variants change surface treatment, not size or press response: `default` (foreground fill), `accent` (primary), `secondary`, `outline`, `ghost`, `destructive`, `link`. Max one `default`/`accent` per cluster; destructive always confirm-gated. `loading` = disabled + dim + `aria-busy`; the label never changes and nothing is injected — no pulsing pill inside buttons.                                                                                        |
| Navigation rows (`.app-nav-row`)                        | Sidebar, drawer, and settings text rows share one size: 40px desktop and 44px below `sm`, with 13px text, 10px radius, and the shared press response. Nested rows keep the same height with 12px text. Icon rail items are 40px squares, 44px below `sm` or on coarse pointers.                                                                                                                                                                                                                                                                                                                                                 |
| CircleButton / ButtonCapsule                            | App-wide icon actions (Section 2.7). Lone = circle 40px desktop and 44px below `sm` or on coarse pointers, hairline border, same `scale(0.97)` press via `.btn-motion`. Adjacent icon actions join in a `ButtonCapsule` (`bg-muted/60`, `p-1`, `gap-1`, vertical variant for the rail); direct children lose their individual borders. Never for navigation rows.                                                                                                                                                                                                                                                               |
| Input                                                   | Height 40px desktop and 44px below `sm` or on coarse pointers, radius 10px, 1px border, focus = border-color goes accent (`--ring`) and nothing else: no `box-shadow` halo, no `outline`. The focus override lives in `@layer utilities` — a components-layer rule loses to the `border-input` utility regardless of specificity. Label 13px medium above, helper/error 12px below, `aria-invalid` on error.                                                                                                                                                                                                                    |
| Card                                                    | radius 12px, hairline border, padding 16/20px, no shadow at rest. Hover lift only for interactive cards.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Dialog                                                  | Desktop: centered, radius 16px, overlay scrim 40% + 4px backdrop blur, enter = fade + scale 0.96→1 + slight y. Mobile (≤sm): bottom sheet, radius 20px top, drag-to-dismiss. Exit mirrors entry exactly.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Settings window (`settings-window.tsx`)                 | App settings renders as a large window at `md`+, not a centered dialog: pinned below the chrome strip (`top: calc(3.5rem + 12px)`), `max-w-[56rem]`, `max-h-[calc(100dvh-5rem)]` with its own internal scroller, radius 16px, `--shadow-overlay`. Same scrim as Dialog (40% + 4px blur) covers the app beneath; the window's own close is a `CircleButton` top-right. Enter/exit on `MORPH`/`MORPH_EXIT`, reduced-motion collapses to opacity. At `≤sm` the nav stacks above the selected detail as the page — one surface, breakpoint-decided, no platform branch (Section 4.1).                                               |
| TabBar (`ui/tab-bar.tsx`)                               | `md:hidden` bottom navigation: a `fixed inset-x-0 bottom-0` bar holding one `.capsule-surface` tray (`--card` + `--shadow-overlay`, 12px blur, `rounded-full`, `p-1`, `gap-1`). Items are `size-11` circles carrying a single 20px stroke icon — no text label; `label` reaches users via `aria-label`/`title`. Press uses the same `scale(0.97)` response as app buttons. The active item gets a shared `layoutId="selection"` pill (`bg-primary`, `SPRING`) plus a 260ms `tab-pop` icon pulse; reduced motion drops both. `aria-current="page"` marks the active route. It navigates routes, so it is not a `role="tablist"`. |
| Badge                                                   | 11px semibold, radius 8px, soft tint + ink in tables; solid fills stay outside tables. Heights unified at 20/22px.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Notification toast                                      | Top-centre card stack — full contract in Section 3.2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Empty states                                            | Centered, icon 40px muted, title 15px semibold, one-line description, one action. No illustrations.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Skeletons                                               | Same shape/size as the loaded content, `animate-pulse` muted. Spinners are banned. Route-level skeletons are page-specific (Section 3.1).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Tables                                                  | Container card radius 12px; header row 11px uppercase muted; rows 44px (touch) / 40px desktop; hover muted bg 140ms; numbers tabular + right-aligned.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Update notice (`updates.ts`, `toast.tsx`)               | Top-centre notification toast — full visual contract in Section 3.3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Update gate (`update-surface.tsx`, `update-dialog.tsx`) | The one undismissable dialog — full contract in Section 3.3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Progress bar (`progress-bar.tsx`)                       | Download/install progress — track `bg-muted` h-2 radius-full, fill `bg-primary` width 0–100% with `transition-[width] duration-200 ease-out` (no JS animation loop: the store already throttles samples and a CSS transition absorbs their spacing). Readout is `formatUpdateProgress` (percent · total size) in `tabular-nums` 12px muted — no transferred bytes, no ETA. `role="progressbar"` + `aria-valuenow`; a `totalBytes` of 0 means unknown and the bar shows an indeterminate shimmer instead of a lying 0%. Never a spinner (Section 3.1).                                                                           |
| Download page (`download.tsx`)                          | Public pre-auth page on a neutral background — full contract in Section 3.4.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

### 3.1 Loading skeletons — every screen gets its own shape

A skeleton stands in for real content, so it must mirror that screen's
layout — never one generic shape for all pages.

- **Route-level (chunk load):** `src/main/ui/components/page-skeletons.tsx`
  holds one skeleton per screen plus `routeSkeleton(pathname)`. The shell's
  `InnerPageLoader` maps the current pathname to the matching skeleton and
  renders it inside the existing page gutter (PageTransition padding applies —
  skeletons never add their own page padding). Standalone routes outside the
  shell (`/auth`, `/login/scan/:code`) wrap their own `Suspense` with
  `AuthSkeleton` / `ScanApproveSkeleton`.
- **Page-level (data load):** pages keep their own shaped skeletons in place
  of their real blocks. Never a bare rectangle where structured content will
  appear.
- **Building blocks:** `PageHeaderSkeleton` (eyebrow `h-3 w-20`, title
  `h-8 w-56`, description `h-3 w-72`, actions `h-10 w-32 rounded-full`),
  `SettingsSkeleton`, `DevicesSkeleton`.
- **Rules:** every skeleton is `aria-hidden`; `animate-pulse` only
  (globals.css collapses it under `prefers-reduced-motion`); tokens only,
  no raw colors; a new screen ships with its own skeleton entry in
  `routeSkeleton` in the same change.

### 3.2 Notification toast

Top-centre card stack: radius 12px, card surface, hairline border, overlay
shadow, auto-dismiss. Drops from the top edge on `EASE_OUT` — 380ms in,
300ms out (overrides sonner's 400ms `ease`; see Section 5); exits mirror
entries. A tinted status glyph sits left of a 14px semibold title with an
optional 13px muted description, and that second line always renders.
Dwell 4000ms success / 8000ms error (Material 3's 4–10s band). Max 3
visible. Dismiss by the close button or a swipe. Every shell renders the
same toast through the shared bundle (Sonner at `position="top-center"`;
`ui/components/toast.tsx` configures it, `main.tsx` configures the toast sink,
and `ui/App.tsx` mounts it). There is no separate Android toast file.

### 3.3 Update surfaces

- **Routine update notice** — uses the top-centre notification toast from
  Section 3.2. It has a short title and one-line description, with no action.
  The update schedule and per-shell copy live in `spec.md` Section 5.3.
- **Update gate (`update-dialog.tsx`)** — the one undismissable dialog:
  `hideClose`, no outside/Escape dismiss, icon + title + one-line
  description + single action button. Action AND copy come from the host's
  update action (`updateAction()` in platform.ts, never a host check in the
  component): web `Reload now`, Windows/Linux `Restart and update`, macOS
  `Download update` (manual DMG), Android `Update app`. While the update downloads it gains a
  centered 12px tabular readout (`formatUpdateProgress`: percent · size) and
  the button dims via `loading` — the label never changes. A failed attempt
  renders one honest line from the store's `failure` (the release is still
  publishing; the download failed verification; Android needs install
  permission or could not open the installer) — a connection message appears
  only when the update service could not be reached.
  Forced update only — never reuse this pattern for anything dismissable.
  At `≤sm` (including the Android shell) it renders as an undismissable
  bottom sheet against the same contract.

### 3.4 Download page (`download.tsx`)

- A signed-out browser opening `/` goes to `/downloads`. This is the single
  public download page.
- Download uses the neutral page background, the same lockup, and a 640px
  content width. One page title and one version/status line sit above the
  download choices.
- A detected Windows x64, macOS arm64, Linux x64, or Android build gets one
  recommended Card with its brand glyph, package type, and primary Download
  action. CPU detection uses browser hints where available. The accent border
  marks the card; it has no solid accent fill.
- The Linux brand glyph is the monochrome Tux penguin.
- The web action is `Use web version` and opens `/auth`. It appears below the
  recommended download. When the OS or supported CPU target is unknown, it is
  the main action and all installer rows remain available.
- All remaining builds appear as compact rows in one Card. If detection is
  unavailable, all four rows appear. `Installation notes` is a collapsed
  plus/minus disclosure with aligned platform rows and a shared morph panel.
- Download actions are plain anchors to their `/releases/*` URL. The browser
  owns transfer progress; the page does not buffer installers or show a
  second progress indicator. The release manifest supplies every URL.
- Loading uses button-shaped skeletons. An unavailable release has one
  status line and disabled download actions. Spinners are not used.
- Downloads render only in a plain browser (`isPlainBrowser()` in
  `platform.ts`). Electron and Android are the app; `/downloads` redirects to
  `/auth` in those shells.

## 4. Layout

- Content max width: 1200px for data pages, 640px for forms/auth.
- Page structure is always: `PageHeader` (title + desc + actions) → optional
  filter bar → content. Eyebrow, title, and description never repeat the
  same concept. One primary action top-right; secondary inside.
- Mobile: single column, cards; ≥sm: grids (`minmax(0,1fr)`); ≥xl: data grids
  up to 4 columns. Card grids keep equal heights (`grid` + stretch).
- Mobile nav: floating shortcuts (Section 2.7.2) plus one full-screen nav
  drawer, opened from More or the header menu circle. Desktop: left sidebar.
  Drawer and sidebar share the same items, order and icons.
- Full-screen nav drawer: covers
  the viewport (`inset-0`, `bg-background`), slides from the left 280ms
  `EASE_DRAWER`, exits 20% faster, no scrim (nothing remains visible to tap).
  Closed by X, Escape or navigation. Layout top→bottom: brand title
  (`text-2xl`, 700, −0.022em, "KS Biz App") with company line, a
  touch close circle top-right, the shared nav list, and a pinned footer:
  identity (avatar 36px + name + email/phone) left, a theme-toggle + log-out
  circle capsule right. Drawer, sidebar, and settings text rows share
  `.app-nav-row` / `.app-nav-subrow`: 40px desktop, 44px below `sm` or on
  coarse pointers, 13px/12px labels, 16px icons, and `rounded-md` selection.
  Reduced-motion disables spatial movement and keeps fades within 200ms.
- A collapsed sidebar expands on hover as an overlay — the page underneath
  never moves. Opening waits ~120ms of hover intent; closing waits ~180ms
  after the pointer leaves. The overlay carries no shadow — the hairline
  border is the only edge in the shell.
- A parent item with sub-items is a toggle, never a selection: it never
  takes the accent pill, even when one of its subs is active. The active
  sub alone takes the pill; the parent renders `font-medium
text-foreground` while a sub is active. The collapsed rail keeps the
  pill on the parent icon (its subs aren't visible there).
- Every screen answers: Where am I? (header) Where can I go? (nav)
  How do I get out? (back/close) — wayfinding is never optional.

### 4.1 Android shell — phone scale

`apps/android` is a Capacitor 8 WebView over the same `apps/app` bundle —
no second UI, no Android token set, nothing to port. The phone renders the
web layout at the `≤sm` breakpoint (Section 4). Behaviour, adapter
branching, and release steps live in `spec.md` Section 5 — this document
keeps only the visual contract: the update gate renders as an undismissable
bottom sheet (Section 3.3), and routine APK availability stays in Settings
as OS chrome, not an in-app surface.

## 5. Motion grammar

Presets live in `src/main/ui/lib/motion.ts` — import them, never re-derive.

| Preset          | Value                                             | Use                                     |
| --------------- | ------------------------------------------------- | --------------------------------------- |
| `EASE_OUT`      | `cubic-bezier(0.16,1,0.3,1)`                      | all enter/exit tweens                   |
| `EASE_IN_OUT`   | `cubic-bezier(0.65,0,0.35,1)`                     | symmetric repositions                   |
| `EASE_DRAWER`   | `cubic-bezier(0.32,0.72,0,1)`                     | sheets/drawers                          |
| `SPRING`        | spring, bounce 0, 0.38s                           | default for anything touchable          |
| `MORPH`         | alias of `SPRING`                                 | morph entrances (Section 5.1)           |
| `MORPH_EXIT`    | spring, bounce 0, 0.3s                            | morph exits — ~20% faster (Section 5.1) |
| `DRAWER_SPRING` | spring, bounce 0.12, 0.36s                        | ONLY momentum-driven (flicked sheets)   |
| Durations       | 120 press / 140 fast / 200 base / ≤400ms anything | —                                       |

Rules:

1. **MORPH covers every state-driven size or shape change.** Use the shared
   380ms, zero-bounce spring for Motion `layout`/`layoutId`; use 300ms for
   exits. CSS content expansion uses `MorphPanel`, `grid-template-rows`, and
   the `--duration-morph-open` / `--duration-morph-exit` tokens with
   `--ease-morph`.
   Sonner stack-size changes use `--ease-morph`. Sidebar pinning animates the
   sidebar with Motion `layout` and the content-column padding with
   `--ease-morph`. Data progress fills keep their 200ms transition. Never
   animate layout with `top`, `left`, or margins.
2. **Enter and exit are the same path reversed.** Slide in from right → dismiss
   to right. Morph exits use 300ms; entries use 380ms.
3. **Bounce only after momentum.** Dialogs, sheets, fades: bounce 0. Flicked
   sheets: ≤0.12. Nothing else.
4. **Choreography:** stagger siblings 40ms (max ~5 items staggered), page
   entrance = fade + 4–6px rise ≤240ms. No parallax, no looping animations
   (one exception: the pre-auth wash drift — 38–47s alternate, transform
   only, stills under `prefers-reduced-motion`), no hover scale >1, no
   emoji/confetti.
5. **Press feedback is instant** (`:active` or pointer-down), 100ms, scale
   0.97 on controls, background tint on list rows. Implement with the shared
   `.btn-motion` transition (globals.css): transform 100ms, colors 150ms —
   never a single `duration-150` list where the press scale inherits the
   hover pace.
6. **Interruptibility:** anything a user can grab uses springs (motion/react);
   re-target from current value, carry velocity.
7. **When in doubt, don't animate.** Motion earns its place by explaining
   where things came from or where they went.
8. `prefers-reduced-motion`: spatial movement and press scaling are disabled;
   remaining fades and color changes stay within 200ms (handled centrally in
   globals.css + `useReducedMotion()` in components).

**Third-party surfaces** ship their own animation timing. Sonner's toasts
default to 400ms `ease`; `globals.css` overrides the toast transition to
`EASE_OUT` so the notification toast (Section 3.2) matches this grammar.
Any third-party animated surface gets the same override — never a
documented exception.

### 5.1 Overlay surfaces

Dialogs and overlay windows enter and exit on one curve pair, never a cut.

- Timing: `MORPH` in, `MORPH_EXIT` out (`src/main/ui/lib/motion.ts`). Both
  use the critically damped SPRING curve; entries are 380ms and exits 300ms.
- Desktop dialog: `opacity 0→1`, `scale 0.96→1`, `y 8→0`, centred with a
  `-50% -50%` translate. Radius is static (`rounded-xl`, 16px) — no radius
  step while open.
- At `≤sm` the same dialog becomes an iOS bottom sheet: `y 100%→0` slides
  the full path, top corners `rounded-t-2xl`, safe-area bottom padding.
  One component, breakpoint-decided, no platform branch (Section 4.1).
- The settings window (Section 3) runs the desktop pair, pinned below the
  3.5rem chrome strip with a `-50% 0` translate and its own scroller.
- Scrim: `bg-black/40` + `backdrop-blur-[4px]`, `opacity` on a fixed 0.2s
  `EASE_OUT`.
- Reduced motion collapses every surface to a bare `opacity` fade, with
  `duration: 0` on exit.
- CSS-only disclosures use `MorphPanel` and `grid-template-rows` with
  `--ease-morph` (the SPRING curve, sampled once in globals.css) — never a raw
  CSS width/height tween.

## 6. Accessibility floor (non-negotiable)

- 44×44px touch targets on coarse pointers; dense 32/40px sizes stay on
  desktop. Visible focus ring (2px accent, 2px offset) alongside the
  hairline brighten;
  `aria-invalid` + inline error text; labels on every input (no placeholder-
  only labels); contrast ≥ 4.5:1 body / 3:1 large; safe-area insets honored;
  `tabular-nums` for anything numeric that updates.

## 7. Codebase map (where things live)

| Concern                                         | File                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| Tokens (color/radius/shadow/ease/motion timing) | `src/main/ui/globals.css`                                                             |
| Motion presets                                  | `src/main/ui/lib/motion.ts`                                                           |
| Stagger/Skeleton/PageTransition                 | `src/main/ui/components/motion.tsx`                                                   |
| Per-screen route skeletons (Section 3.1)        | `src/main/ui/components/page-skeletons.tsx`                                           |
| Primitives (shadcn-style)                       | `src/main/ui/components/ui/*`                                                         |
| Morphing disclosure panels                      | `src/main/ui/components/ui/disclosure.tsx`                                            |
| Circular icon buttons & capsules (Section 2.7)  | `src/main/ui/components/ui/circle-button.tsx`                                         |
| App frame (sidebar/header/nav drawer)           | `src/main/ui/components/app-shell.tsx`                                                |
| Settings window (desktop overlay, Section 3)    | `src/main/ui/components/settings-window.tsx`                                          |
| Nav tree (sections/items/subs)                  | `src/main/ui/components/nav-config.tsx`                                               |
| Page scaffold                                   | `src/main/ui/components/page-header.tsx`                                              |
| Update surfaces (notice/gate)                   | `src/main/ui/components/update-surface.tsx`                                           |
| Notification toast (top-centre)                 | `src/main/ui/components/toast.tsx`, configured in `main.tsx`, mounted in `ui/App.tsx` |
| OS brand glyphs (download/entry)                | `src/main/ui/components/brand-icons.tsx`                                              |
| Error-code → human copy                         | `packages/app-core/src/errors.ts` (`friendlyError`)                                   |

## 8. Agent checklist (before any UI change ships)

- [ ] Radii/heights/spacing match Section 2 — no new magic numbers.
- [ ] Same-height, same-radius controls within each row/cluster.
- [ ] One primary action per screen region; destructive gated by confirm.
- [ ] Loading = skeletons shaped like the content; empty = Empty pattern.
- [ ] Motion uses presets, honors reduced-motion, exits mirror entries.
- [ ] Dark mode checked (tokens only — no raw colors).
- [ ] 44px targets + focus rings + labels verified on the mobile breakpoint.
- [ ] Looks at home next to macOS System Settings / Linear / Luma. If it reads
      as "admin template", it is not done.
- [ ] This document updated in the same change (Section 9).

## 9. Keeping this document current

This document is a living contract, not a snapshot. After every UI
change, in the same change:

1. If you used a value or pattern this document doesn't define, add it
   here first (owner approves), then use it.
2. If a change made any section above untrue, rewrite that section to
   describe what IS now — current state only, no history narration.
3. One bundle, one UI — a change to any section is a change to every shell
   that renders it. Platform-specific behaviour belongs only in
   `apps/app/spec.md` (Section 5.1), never as a UI fork here. Run the
   verification protocol in `AGENTS.md` Sections 2.3–2.4.
4. If code and this document disagree, the mismatch ships fixed in the
   same change, never deferred.
