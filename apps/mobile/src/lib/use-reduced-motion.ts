/**
 * Reduced-motion contract: every Reanimated preset reads this hook and falls
 * back to duration 0, so a device with animations disabled behaves exactly like
 * the web app's `prefers-reduced-motion` block (globals.css).
 */
import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (!cancelled) setReduce(enabled);
      })
      .catch(() => {
        // Platform cannot answer — keep the current value.
      });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduce,
    );
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return reduce;
}

/** Milliseconds for a preset, collapsed to 0 under reduced motion. */
export function motionMs(ms: number, reduce: boolean): number {
  return reduce ? 0 : ms;
}
