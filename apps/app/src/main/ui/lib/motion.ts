import type { Transition, Variants } from "motion/react";

/** Apple cubic-beziers — spatial consistency, symmetric paths */
export const EASE = [0.16, 1, 0.3, 1] as const;
export const EASE_OUT: readonly [number, number, number, number] = [
  0.16, 1, 0.3, 1,
] as const;

/** Apple springs — critically damped by default, bounce only for momentum */
export const SPRING: Transition = {
  type: "spring",
  bounce: 0,
  duration: 0.38,
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
    transition: { duration: 0.22, ease: EASE_OUT },
  },
};
