"use client";

import { Section } from "@/components/section/Section";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { testimonials } from "@/content/testimonials";
import { SectionHead } from "@/components/section/SectionHead";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { cn } from "@kataria-syntex/shared";

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0] ?? "")
    .slice(0, 2)
    .join("");

/**
 * Buyer voices — a ledger of quotes that swap with a fade and a soft rise.
 * Auto-advances, pauses on hover, and freezes entirely under
 * prefers-reduced-motion.
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
                className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-navy/30 text-navy transition-[border-color,color,transform] duration-200 ease-[var(--ease-out)] hover:border-royal hover:text-royal active:scale-[0.94]"
              >
                <ArrowLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next quote"
                className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-navy/30 text-navy transition-[border-color,color,transform] duration-200 ease-[var(--ease-out)] hover:border-royal hover:text-royal active:scale-[0.94]"
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
            className="relative min-h-64 md:col-span-8"
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            onFocus={() => setHovering(true)}
            onBlur={() => setHovering(false)}
          >
            <span
              aria-hidden="true"
              className="absolute -top-6 -left-1 font-display text-[96px] leading-none font-bold text-royal/15 select-none md:-left-4 md:text-[128px]"
            >
              “
            </span>
            {testimonials.map((testimonial, index) => (
              <figure
                key={testimonial.name}
                aria-hidden={index !== active}
                className={cn(
                  "absolute inset-0 flex flex-col justify-center transition-[opacity,translate] duration-500 ease-[var(--ease-out)]",
                  index === active
                    ? "translate-y-0 opacity-100"
                    : "translate-y-3 opacity-0",
                )}
                style={{ pointerEvents: index === active ? "auto" : "none" }}
              >
                <blockquote className="text-pretty font-display text-2xl leading-snug font-medium tracking-tight text-navy md:text-3xl">
                  {testimonial.quote}
                </blockquote>
                <figcaption className="mt-7 flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-royal to-navy font-display text-[13px] font-bold text-white"
                  >
                    {initials(testimonial.name)}
                  </span>
                  <span className="font-mono text-xs text-ink-soft">
                    <span className="text-navy">{testimonial.name}</span> ·{" "}
                    {testimonial.company} · {testimonial.country}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </Section>
    </section>
  );
}
