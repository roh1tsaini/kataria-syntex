import { liftedCard } from "@/components/ui/lifted-card";
import { cn } from "@/lib/utils";
import { Section } from "@/components/section/Section";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { shades } from "@/content/shades";
import { SectionHead } from "@/components/section/SectionHead";
import { Reveal } from "@/components/motion/Reveal";
import { YarnSwatch } from "@/components/shade/YarnSwatch";

/**
 * Shade card teaser — a band of real wound-yarn strands from the physical
 * shade card, presented as the card itself, linking to the full interactive
 * card.
 */
export function ShadeStrip() {
  // A dye-heavy run across the card: every 6th shade gives a full-spectrum band.
  const band = shades.filter((_, index) => index % 6 === 0).slice(0, 26);

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
            className={cn("block p-1.5", liftedCard)}
          >
            <div className="flex flex-wrap gap-1 overflow-hidden rounded-[11px]">
              {band.map((shade) => (
                <YarnSwatch
                  key={shade.code}
                  colors={shade.colors ?? [shade.hex]}
                  rowHeight={7}
                  className="h-[84px] min-w-[92px] flex-1 rounded-[3px]"
                />
              ))}
            </div>
          </Link>
        </Reveal>
      </Section>
    </section>
  );
}
