"use client";

import { useRef, useState, type ReactNode } from "react";
import { cn } from "@kataria-syntex/shared";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { useInViewOnce } from "@/lib/use-in-view-once";

/**
 * Reveal — sections surface through a crossfade with a small rise.
 * Respects prefers-reduced-motion by rendering content immediately.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [intersected, setIntersected] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useInViewOnce(ref, () => setIntersected(true), {
    threshold: 0.12,
    rootMargin: "0px 0px -8% 0px",
  });

  const shown = reducedMotion || intersected;

  return (
    <div
      ref={ref}
      data-shown={shown}
      className={cn("ks-reveal", className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
