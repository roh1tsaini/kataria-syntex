import type { ReactNode } from "react";
import { Section } from "@/components/section/Section";

/**
 * Page-opening band for interior pages — the shared aurora atmosphere with
 * a kicker, display title, and lede. Content sections continue below it.
 */
export function PageHead({
  kicker,
  title,
  lede,
  children,
}: {
  kicker: string;
  title: ReactNode;
  lede?: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden ks-aurora-light">
      <div
        aria-hidden="true"
        className="absolute inset-0 ks-grid-blue [mask-image:radial-gradient(70%_80%_at_50%_0%,black,transparent)]"
      />
      <Section className="relative pt-12 pb-12 md:pt-16 md:pb-14">
        <p className="flex items-center gap-3 font-body text-[11px] font-bold uppercase tracking-[0.07em] text-royal">
          <span aria-hidden="true" className="h-px w-8 bg-royal/40" />
          {kicker}
        </p>
        <h1 className="mt-4 max-w-3xl text-balance font-display text-[clamp(2.25rem,4.6vw,3.25rem)] font-bold leading-[1.04] tracking-tight text-navy">
          {title}
        </h1>
        {lede ? (
          <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-ink-soft md:text-lg">
            {lede}
          </p>
        ) : null}
        {children}
      </Section>
    </section>
  );
}
