import type { Transition, Variants } from "motion/react";

/** Apple cubic-beziers — spatial consistency, symmetric paths */
export const EASE_OUT: readonly [number, number, number, number] = [
  0.16, 1, 0.3, 1,
] as const;
export const EASE_DRAWER: readonly [number, number, number, number] = [
  0.32, 0.72, 0, 1,
] as const;

/** Durations in seconds — 120 press / 140 fast / 200 base / 400 max. */
const DURATIONS = {
  press: 0.12,
  fast: 0.14,
  base: 0.2,
  max: 0.4,
} as const;

/** Apple springs — critically damped by default, bounce only for momentum */
export const SPRING: Transition = {
  type: "spring",
  bounce: 0,
  duration: 0.38,
};

/** Morph entrances (pill ⇄ card, shared-element) reuse SPRING. */
export const MORPH: Transition = SPRING;
/** Morph exits — same path, ~20% faster (design.md §5.6). */
export const MORPH_EXIT: Transition = {
  type: "spring",
  bounce: 0,
  duration: 0.3,
};
/** Parent that staggers its children on "show" (design.md §5.5: ~40ms
 * sibling stagger). Import — never re-derive at the call site. */
export function staggerContainer(
  stagger = 0.04,
  delayChildren = 0.01,
): Variants {
  return {
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren } },
  };
}

/** Fade + rise entrance for staggered children. */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATIONS.base, ease: EASE_OUT },
  },
};
