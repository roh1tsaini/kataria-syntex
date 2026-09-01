"use client";

import { Section } from "@/components/section/Section";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { testimonials } from "@/content/testimonials";
import { SectionHead } from "@/components/section/SectionHead";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

/**
 * Buyer voices — a crossfade ledger. Quotes swap through opacity only;
 * the tabular counter tracks position. Auto-advances, pauses on hover,
 * and freezes entirely under prefers-reduced-motion.
 */
export function Testimonials() {
  const [active, setActive] = useState(0);
  const [hovering, setHovering] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  const step = useCallback(
    (direction: 1 | -1) =>
      setActive(
        (current) =>
          (current + direction + testimonials.length) % testimonials.length,
      ),
    [],
  );

  useEffect(() => {
    if (hovering || prefersReducedMotion) return;
    const timer = setInterval(() => step(1), 6500);
    return () => clearInterval(timer);
  }, [hovering, prefersReducedMotion, step]);

  return (
    <section className="bg-canvas-deep">
      <Section>
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <SectionHead
              kicker="Buyer voices"
              title="Repeat business is the reference."
            />
            <div className="mt-8 flex items-center gap-3">
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Previous quote"
                className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-navy/30 text-navy transition-colors hover:border-royal hover:text-royal"
              >
                <ArrowLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next quote"
                className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-navy/30 text-navy transition-colors hover:border-royal hover:text-royal"
              >
                <ArrowRight className="size-4" />
              </button>
              <p className="tnum ml-2 font-mono text-xs text-ink-soft">
                {String(active + 1).padStart(2, "0")} —{" "}
                {String(testimonials.length).padStart(2, "0")}
              </p>
            </div>
          </div>

          <div
            className="relative min-h-56 md:col-span-8"
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            onFocus={() => setHovering(true)}
            onBlur={() => setHovering(false)}
          >
            {testimonials.map((testimonial, index) => (
              <figure
                key={testimonial.name}
                aria-hidden={index !== active}
                className="absolute inset-0 transition-[opacity,filter] duration-300 ease-[var(--ease-out)]"
                style={{
                  opacity: index === active ? 1 : 0,
                  filter: index === active ? "blur(0)" : "blur(2px)",
                  pointerEvents: index === active ? "auto" : "none",
                }}
              >
                <blockquote className="font-display text-2xl font-medium leading-snug tracking-tight text-navy md:text-3xl">
                  “{testimonial.quote}”
                </blockquote>
                <figcaption className="mt-6 font-mono text-xs text-ink-soft">
                  {testimonial.name} · {testimonial.company} ·{" "}
                  {testimonial.country}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </Section>
    </section>
  );
}
