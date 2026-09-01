"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Inertial smooth scrolling for the whole site. Native scroll position
 * stays the source of truth (Lenis drives the real scroller), so the
 * browser's own scrollbar, keyboard, and find-in-page keep working.
 * Skipped entirely under prefers-reduced-motion — those users get the
 * platform scroll.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      // Responsive smoothing — low enough to glide, high enough to never
      // feel laggy behind the pointer/wheel.
      lerp: 0.14,
      anchors: true,
    });

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => {
      if (reduced.matches) lenis.destroy();
    };
    reduced.addEventListener("change", onChange);

    return () => {
      reduced.removeEventListener("change", onChange);
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return null;
}
