import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { site } from "@/content/site";
import { shades, shadeBand, isLightShade, type Shade } from "@/content/shades";
import { YarnSwatch } from "@/components/shade/YarnSwatch";
import { cn } from "@/lib/utils";

/**
 * Home hero — aurora wash over the shared blue canvas, with a floating
 * frosted shade-card panel. Swatches and codes come straight from the
 * physical card data; the panel is a miniature of the real thing
 * (wound-yarn texture, mono header, printed codes).
 */
export function Hero() {
  const panel = shadeBand(24);
  const labels = [2, 7, 13, 19]
    .map((i) => panel[i])
    .filter((s): s is Shade => s !== undefined);

  return (
    <section className="relative overflow-hidden ks-aurora-light">
      <div
        aria-hidden="true"
        className="absolute inset-0 ks-grid-blue [mask-image:radial-gradient(72%_64%_at_50%_28%,black,transparent)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 ks-noise opacity-[0.12] mix-blend-overlay"
      />

      <div className="relative mx-auto grid max-w-[1180px] items-center gap-14 px-4 pt-12 pb-28 sm:px-6 md:pt-16 md:pb-36 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <div>
          <p className="ks-enter inline-flex items-center gap-2 rounded-full border border-line bg-paper/70 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft shadow-xs backdrop-blur-sm">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-sky" />
            B2B yarn supply — {site.base} · Est. {site.establishedYear}
          </p>
          <h1
            className="ks-enter mt-7 max-w-xl text-balance font-display text-[clamp(2.75rem,5.6vw,4.25rem)] font-bold leading-[1.01] tracking-[-0.03em] text-navy"
            style={{ animationDelay: "70ms" }}
          >
            The right yarn,
            <br />
            with a <span className="text-royal">straight answer</span>.
          </h1>
          <p
            className="ks-enter mt-6 max-w-xl text-pretty text-base leading-relaxed text-ink-soft md:text-lg"
            style={{ animationDelay: "140ms" }}
          >
            Cotton, polyester, and dyed yarn for weaving units, exporters, and
            garment teams — quoted on your requirement, not a price list.
          </p>
          <div
            className="ks-enter mt-9 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "210ms" }}
          >
            <Button asChild variant="primary" size="lg">
              <Link href="/contact">
                Send an inquiry
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="/products">Browse the yarns</Link>
            </Button>
          </div>
          <p
            className="ks-enter tnum mt-9 font-mono text-[11px] tracking-wide text-ink-soft"
            style={{ animationDelay: "260ms" }}
          >
            {site.contact.coords} — QUOTED ON YOUR REQUIREMENT
          </p>
        </div>

        {/* Floating shade-card panel */}
        <div className="relative">
          <div
            className="ks-enter card-sheen rounded-panel border border-line bg-paper/80 p-5 shadow-float backdrop-blur-md md:p-6"
            style={{ animationDelay: "180ms" }}
          >
            <div className="flex items-baseline justify-between border-b border-line pb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
              <span>RAJ shade card</span>
              <span className="tnum">{shades.length} shades</span>
            </div>
            <div className="mt-4 grid grid-cols-6 gap-1.5">
              {panel.map((shade) => (
                <YarnSwatch
                  key={shade.code}
                  colors={shade.colors ?? [shade.hex]}
                  rowHeight={6}
                  seed={shade.code}
                  className="aspect-square rounded-[6px]"
                />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {labels.map((shade) => (
                <span
                  key={shade.code}
                  className={cn(
                    "tnum rounded-full px-2.5 py-1 font-mono text-[10px] shadow-xs",
                    isLightShade(shade.hex) ? "text-navy" : "text-white",
                  )}
                  style={{ backgroundColor: shade.hex }}
                >
                  {shade.code}
                </span>
              ))}
            </div>
            <Link
              href="/shade-card"
              className="group mt-5 inline-flex items-center gap-2 font-body text-sm font-semibold text-royal transition-colors hover:text-navy"
            >
              Open the shade card
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform duration-300 group-hover:translate-x-1"
              />
            </Link>
          </div>

          {/* Floating accent chip — a small dyed-lot note pinned to the panel */}
          <div
            className="ks-enter absolute -bottom-6 right-6 hidden items-center gap-2.5 rounded-control border border-line bg-paper/90 py-2.5 pr-4 pl-3 shadow-card backdrop-blur-sm xs:flex sm:right-10"
            style={{ animationDelay: "340ms" }}
          >
            <YarnSwatch
              colors={["#C10328", "#A61B3C"]}
              rowHeight={5}
              seed="chip"
              className="h-8 w-6 rounded-[5px]"
            />
            <p className="font-mono text-[10px] leading-snug tracking-wide text-ink-soft">
              LOT-MATCHED
              <br />
              <span className="text-navy">ON LAB DIP</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
