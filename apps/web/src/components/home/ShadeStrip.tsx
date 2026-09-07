import { cn } from "@kataria-syntex/shared";

// Keep in sync with the same token in components/products/ProductCard.tsx.
const liftedCard =
  "card-sheen relative rounded-card border border-line bg-paper shadow-card transition-[translate,box-shadow] duration-300 ease-[var(--ease-out)] hover:-translate-y-1 hover:shadow-float";
import { Section } from "@/components/section/Section";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { shadeBand, shades, shadePages } from "@kataria-syntex/shared";
import { SectionHead } from "@/components/section/SectionHead";
import { Reveal } from "@/components/motion/Reveal";
import { YarnSwatch } from "@/components/shade/YarnSwatch";

/**
 * Shade card teaser — a band of real wound-yarn strands presented as the
 * card itself: printed header, the strand band, and a link footer. The
 * whole panel is the link.
 */
export function ShadeStrip() {
  const band = shadeBand(26);

  return (
    <section className="bg-canvas-deep">
      <Section>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHead
            kicker="The shade card"
            title={`${shades.length} shades on file.`}
            lede="Transcribed from the physical card — browse the full grid and request any shade by code."
          />
          <Reveal>
            <Link
              href="/shade-card"
              className="group inline-flex items-center gap-2 font-body text-sm font-semibold text-royal transition-colors hover:text-navy"
            >
              Open the shade card
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform duration-300 group-hover:translate-x-1"
              />
            </Link>
          </Reveal>
        </div>

        <Reveal className="mt-10 md:mt-14">
          <Link
            href="/shade-card"
            aria-label="Open the full shade card"
            className={cn("group block p-1.5", liftedCard)}
          >
            <div className="flex items-baseline justify-between px-3 pt-2 pb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
              <span>RAJ shade card</span>
              <span className="tnum">
                Pages {shadePages[0]}–{shadePages[shadePages.length - 1]} ·{" "}
                {shades.length} shades
              </span>
            </div>
            <div className="flex flex-wrap gap-1 overflow-hidden rounded-[11px]">
              {band.map((shade) => (
                <YarnSwatch
                  key={shade.code}
                  colors={shade.colors ?? [shade.hex]}
                  rowHeight={7}
                  seed={shade.code}
                  className="h-[84px] min-w-[92px] flex-1 rounded-[3px] transition-[filter] duration-300 group-hover:brightness-105"
                />
              ))}
            </div>
            <p className="px-3 pt-3 pb-2 font-body text-xs font-semibold text-royal">
              Browse every shade by code
              <ArrowRight
                aria-hidden="true"
                className="ml-1.5 inline size-3.5 transition-transform duration-300 group-hover:translate-x-1"
              />
            </p>
          </Link>
        </Reveal>
      </Section>
    </section>
  );
}
