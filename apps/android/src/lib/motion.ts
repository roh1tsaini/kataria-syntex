/**
 * Motion tokens — the Android counterpart of apps/app's motion.ts.
 * Calm feel: springs are critically damped (no overshoot), ~380ms settle;
 * exits mirror entries ~20% faster (design.md §5.6). Reanimated 4 springs
 * are configured with stiffness/damping/mass — damping = 2·√(stiffness·mass)
 * is the critically damped value; settle time ≈ 4/√(stiffness·mass).
 */

import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { Easing } from "react-native-reanimated";
import type { WithSpringConfig } from "react-native-reanimated";

/** Drawer easing — Apple's spatial curve, matching apps/app EASE_DRAWER.
 *  Spatial motion uses a bezier, not a spring (design.md §5). */
export const EASE_DRAWER = Easing.bezier(0.32, 0.72, 0, 1);
/** Full-screen nav drawer entrances are 280ms; exits mirror ~30% faster. */
export const DRAWER_ENTER_MS = 280;
export const DRAWER_EXIT_MS = 200;

/** Default spring for anything that moves: ~0.38s, no bounce. */
export const SPRING: WithSpringConfig = {
  mass: 1,
  stiffness: 110,
  damping: 21,
};

/** Morph/sheet entrances use SPRING; exits run ~20% faster. */
export const MORPH: WithSpringConfig = SPRING;
export const MORPH_EXIT: WithSpringConfig = {
  mass: 1,
  stiffness: 180,
  damping: 27,
};

/** OS-level reduce motion — mirrors `useReducedMotion()` on the web app. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduce(value);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduce,
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}
