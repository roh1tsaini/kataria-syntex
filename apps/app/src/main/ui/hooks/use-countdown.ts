import { useEffect, useState } from "react";

export type Countdown = {
  mm: number;
  ss: number;
};

/** Seconds until target, clamped at 0. */
function leftFor(target: string | null): number {
  if (!target) return 0;
  return Math.max(
    0,
    Math.round((new Date(target).getTime() - Date.now()) / 1000),
  );
}

/**
 * Time remaining until an ISO timestamp, clamped at 0, split into minutes and
 * seconds so callers render `{mm}:{ss}` without formatting it themselves.
 * A newly set target is derived during render — the ticking effect runs
 * after paint, so callers reading the value on the same commit never see a
 * stale 0.
 */
export function useCountdown(target: string | null): Countdown {
  const [state, setState] = useState<{ target: string | null; left: number }>({
    target: null,
    left: 0,
  });
  const secondsLeft = state.target === target ? state.left : leftFor(target);
  useEffect(() => {
    if (!target) {
      // Reset to 0 when the target goes away instead of returning a stale
      // count from the previous target.
      setState({ target: null, left: 0 });
      return;
    }
    const update = () => {
      const left = leftFor(target);
      setState((prev) =>
        prev.target === target && prev.left === left ? prev : { target, left },
      );
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [target]);
  return { mm: Math.floor(secondsLeft / 60), ss: secondsLeft % 60 };
}
