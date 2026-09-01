import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { site } from "@/content/site";
import { shades, isLightShade } from "@/content/shades";
import { YarnSwatch } from "@/components/shade/YarnSwatch";
import { cn } from "@/lib/utils";

/**
 * Home hero — light wash with a floating shade-card panel. Swatches and
 * codes come straight from the physical card data; the panel is a miniature
 * of the real thing (wound-yarn texture, mono header, printed codes).
 */
export function Hero() {
  const panel = shades.filter((_, index) => index % 6 === 0).slice(0, 24);
  const labels = [panel[2], panel[7], panel[13], panel[19]];

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-[1180px] items-center gap-12 px-4 py-14 sm:px-6 md:py-21 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <div>
          <p className="ks-enter inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-sky" />
            B2B yarn supply — {site.base} · Est. {site.establishedYear}
          </p>
          <h1
            className="ks-enter mt-6 font-display text-[clamp(2.5rem,5vw,3.75rem)] font-bold leading-[1.02] tracking-tight text-navy"
            style={{ animationDelay: "60ms" }}
          >
            The right yarn,
            <br />
            with a <span className="text-royal">straight answer</span>.
          </h1>
          <p
            className="ks-enter mt-5 max-w-xl text-base leading-relaxed text-ink-soft md:text-lg"
            style={{ animationDelay: "120ms" }}
          >
            Cotton, polyester, and dyed yarn for weaving units, exporters, and
            garment teams — quoted on your requirement, not a price list.
          </p>
          <div
            className="ks-enter mt-7 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "180ms" }}
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
            className="ks-enter tnum mt-7 font-mono text-[11px] tracking-wide text-ink-soft"
            style={{ animationDelay: "220ms" }}
          >
            {site.contact.coords} — QUOTED ON YOUR REQUIREMENT
          </p>
        </div>

        {/* Floating shade-card panel */}
        <div
          className="ks-enter rounded-panel border border-line bg-paper p-5 shadow-float md:p-6"
          style={{ animationDelay: "160ms" }}
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
                className="aspect-square rounded-[6px]"
              />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {labels.map((shade) => (
              <span
                key={shade.code}
                className={cn(
                  "tnum rounded-full px-2.5 py-1 font-mono text-[10px] shadow-card",
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
      </div>
    </section>
  );
}
