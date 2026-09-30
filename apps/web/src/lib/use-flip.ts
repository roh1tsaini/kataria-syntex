"use client";

import { useEffect, useRef } from "react";

/**
 * FLIP reflow for filterable grids (design.md §4.2): when the filtered item
 * set changes, surviving children glide from their old position to the new
 * one on the cinematic curve; entering children rise in. Transform +
 * opacity only — no layout animation, no exit ghosts (the survivors' glide
 * carries the change). Positions are cached after every commit, so the
 * previous run's rects are the "first" half of the next flip. No-JS and
 * reduced motion never animate.
 *
 * Mark each child with data-flip-id; changes to `deps` trigger the flip.
 */
export function useFlip<T extends HTMLElement>(deps: readonly unknown[]) {
  const ref = useRef<T | null>(null);
  const positions = useRef(new Map<string, DOMRect>());

  useEffect(() => {
    const grid = ref.current;
    if (!grid) return;

    const prev = positions.current;
    const next = new Map<string, DOMRect>();
    const kids = Array.from(grid.children) as HTMLElement[];
    for (const child of kids) {
      if (child.dataset.flipId)
        next.set(child.dataset.flipId, child.getBoundingClientRect());
    }

    const animate =
      document.documentElement.classList.contains("js") &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      prev.size > 0;

    if (animate) {
      const duration = 600;
      const ease =
        getComputedStyle(grid).getPropertyValue("--ease-cinema").trim() ||
        "cubic-bezier(0.22, 1, 0.36, 1)";

      for (const child of kids) {
        const id = child.dataset.flipId;
        if (!id) continue;
        const before = prev.get(id);
        const after = next.get(id);
        if (!after) continue;

        if (!before) {
          child.animate(
            [
              { opacity: 0, transform: "translateY(14px)" },
              { opacity: 1, transform: "translateY(0)" },
            ],
            { duration, easing: ease, fill: "backwards" },
          );
          continue;
        }

        const dx = before.left - after.left;
        const dy = before.top - after.top;
        if (dx === 0 && dy === 0) continue;
        child.animate(
          [
            { transform: `translate(${dx}px, ${dy}px)` },
            { transform: "translate(0, 0)" },
          ],
          { duration, easing: ease },
        );
      }
    }

    positions.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps drive the flip
  }, deps);

  return ref;
}
