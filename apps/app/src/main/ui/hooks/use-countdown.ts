import { useEffect, useState } from "react";

export type Countdown = {
  mm: number;
  ss: number;
};

/**
 * Time remaining until an ISO timestamp, clamped at 0, split into minutes and
 * seconds so callers render `{mm}:{ss}` without formatting it themselves.
 */
export function useCountdown(target: string | null): Countdown {
  const [secondsLeft, setSecondsLeft] = useState(0);
  useEffect(() => {
    if (!target) {
      // Reset to 0 when the target goes away instead of returning a stale
      // count from the previous target.
      setSecondsLeft(0);
      return;
    }
    const update = () =>
      setSecondsLeft(
        Math.max(
          0,
          Math.round((new Date(target).getTime() - Date.now()) / 1000),
        ),
      );
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [target]);
  return { mm: Math.floor(secondsLeft / 60), ss: secondsLeft % 60 };
}
