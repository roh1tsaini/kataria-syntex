"use client";

import { Section } from "@/components/section/Section";
import { useEffect, useRef, useState } from "react";
import { trustMetrics } from "@/content/site";
import { Reveal } from "@/components/motion/Reveal";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { useInViewOnce } from "@/lib/use-in-view-once";

/**
 * Trust metrics band — navy ground, sky numbers that count up once
 * when they enter the viewport (final value renders on the server and
 * under reduced motion; the count is pure enhancement).
 */
export function TrustStrip() {
  return (
    <section aria-label="Trade figures" className="bg-navy">
      <Section>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line-dark bg-line-dark lg:grid-cols-4">
          {trustMetrics.map((metric, index) => (
            <Reveal
              key={metric.label}
              delay={index * 60}
              className="bg-navy p-6 md:p-8"
            >
              <MetricValue value={metric.value} />
              <p className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-ice-soft">
                {metric.label}
              </p>
            </Reveal>
          ))}
        </div>
      </Section>
    </section>
  );
}

function MetricValue({ value }: { value: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [text, setText] = useState(value);
  const [started, setStarted] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useInViewOnce(ref, () => setStarted(true), { threshold: 0.4 });

  useEffect(() => {
    if (!started || reducedMotion) return;
    const match = /^(\d+)(\+?)$/.exec(value);
    if (!match) return;
    const [, digitsRaw, suffix] = match;
    const target = Number.parseInt(digitsRaw, 10);
    if (!Number.isFinite(target) || target === 0) return;

    const duration = 1300;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(2, -10 * t); // easeOutExpo
      const n = Math.round(target * eased);
      setText(String(n).padStart(digitsRaw.length, "0") + suffix);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    setText("0".repeat(digitsRaw.length) + suffix);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, reducedMotion, value]);

  return (
    <p
      ref={ref}
      className="tnum font-display text-[26px] font-bold tracking-tight text-sky md:text-[28px]"
    >
      {text}
    </p>
  );
}
