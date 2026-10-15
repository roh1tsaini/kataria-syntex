/**
 * Motion presets — the RN mirror of the web app's `ui/lib/motion.ts`.
 *
 * Same curves, same durations (design.md Section 5): enter/exit are symmetric
 * paths with exits ~20% faster, the morph spring settles at 380ms, staggered
 * siblings rise 6px on a 40ms cadence, and reduced motion collapses every
 * duration to 0. Duration values are ms because Reanimated works in ms.
 */
import { Easing } from "react-native-reanimated";

/** Apple cubic-beziers - spatial consistency, symmetric paths. */
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_DRAWER = Easing.bezier(0.32, 0.72, 0, 1);

/** Durations in milliseconds. */
export const DURATION = {
  /** Route enter / exit (PageTransition). */
  pageEnter: 160,
  pageExit: 130,
  /** Surface entrances and exits (sheets, morph panels). */
  morphEnter: 380,
  morphExit: 300,
  /** Navigation drawer slide. */
  drawerEnter: 280,
  drawerExit: 200,
  /** Staggered sibling entrances. */
  staggerItem: 200,
  /** Press feedback — transform answers in 100ms, colors keep 150ms. */
  press: 100,
  color: 150,
} as const;

/** Sibling stagger cadence and first-child delay, in milliseconds. */
export const STAGGER_STEP_MS = 40;
export const STAGGER_DELAY_MS = 10;

/** The morph spring as a config: critically damped, settled at 380ms. */
export const SPRING = {
  duration: DURATION.morphEnter,
  dampingRatio: 1,
} as const;
/** Exits mirror entries on the same path, ~20% faster. */
export const SPRING_EXIT = {
  duration: DURATION.morphExit,
  dampingRatio: 1,
} as const;
