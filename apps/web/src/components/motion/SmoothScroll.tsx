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

    // autoRaf lets Lenis own its rAF loop (destroyed with the instance);
    // lerp 0.14 keeps the glide right behind the pointer so frames never
    // feel stale on high-refresh displays.
    const lenis = new Lenis({
      lerp: 0.14,
      anchors: true,
      autoRaf: true,
    });

    // Radix modals lock native scroll via body[data-scroll-locked]; a
    // running Lenis keeps fighting that lock. Park it while any modal is
    // open, resume when the last one closes.
    let locked = false;
    const lockObserver = new MutationObserver(() => {
      const isLocked = document.body.hasAttribute("data-scroll-locked");
      if (isLocked === locked) return;
      locked = isLocked;
      if (isLocked) lenis.stop();
      else lenis.start();
    });
    lockObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-scroll-locked"],
    });

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => {
      if (reduced.matches) {
        lockObserver.disconnect();
        lenis.destroy();
      }
    };
    reduced.addEventListener("change", onChange);

    return () => {
      reduced.removeEventListener("change", onChange);
      lockObserver.disconnect();
      lenis.destroy();
    };
  }, []);

  return null;
}
