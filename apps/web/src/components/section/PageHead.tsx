import type { ReactNode } from "react";
import { Kicker } from "@/components/section/Kicker";
import { Section } from "@/components/section/Section";

/**
 * Page-opening band for interior pages — the shared aurora atmosphere with
 * a kicker, display title, and lede. Content sections continue below it.
 */
export function PageHead({
  kicker,
  title,
  lede,
}: {
  kicker: string;
  title: ReactNode;
  lede?: string;
}) {
  return (
    <section className="relative overflow-hidden ks-aurora-light">
      <div
        aria-hidden="true"
        className="absolute inset-0 ks-grid-blue [mask-image:radial-gradient(70%_80%_at_50%_0%,black,transparent)]"
      />
      <Section className="relative pt-12 pb-12 md:pt-16 md:pb-14">
        <Kicker>{kicker}</Kicker>
        <h1 className="mt-4 max-w-3xl text-balance font-display text-[clamp(2.25rem,4.6vw,3.25rem)] font-bold leading-[1.04] tracking-tight text-navy">
          {title}
        </h1>
        {lede ? (
          <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-ink-soft md:text-lg">
            {lede}
          </p>
        ) : null}
      </Section>
    </section>
  );
}
