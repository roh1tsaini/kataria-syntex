import { liftedCard } from "@/components/ui/lifted-card";
import { cn } from "@/lib/utils";
import { Section } from "@/components/section/Section";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { products } from "@/content/products";
import { SectionHead } from "@/components/section/SectionHead";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Yarn index — the three material families as lifted paper cards on a
 * recessed blue band. The whole card is the link.
 */
export function YarnIndex() {
  const families = products.filter((product) => product.featured);

  return (
    <section className="bg-canvas-deep">
      <Section>
        <SectionHead
          kicker="The yarn index"
          title="Three fibers. Every count that matters."
          lede="Each family is stocked across the counts and deniers Surat runs on — open a yarn for the full specification."
        />

        <div className="mt-10 grid gap-5 md:mt-14 md:grid-cols-3">
          {families.map((product, index) => (
            <Reveal key={product.slug} delay={index * 80}>
              <Link
                href={`/products/${product.slug}`}
                className={cn("group flex h-full flex-col", liftedCard)}
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-t-card">
                  <Image
                    src={product.image}
                    alt={product.imageAlt}
                    fill
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-3 p-6">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="tnum font-mono text-[11px] text-ink-soft">
                      {product.code}
                    </p>
                    <p className="font-body text-[11px] font-bold uppercase tracking-[0.07em] text-royal">
                      {product.category}
                    </p>
                  </div>
                  <h3 className="font-display text-2xl font-bold tracking-tight text-navy">
                    {product.name}
                  </h3>
                  <p className="text-sm leading-relaxed text-ink-soft">
                    {product.headline}
                  </p>
                  <dl className="mt-auto space-y-1.5 border-t border-line pt-4">
                    {product.specs.slice(0, 3).map((spec) => (
                      <div
                        key={spec.label}
                        className="flex justify-between gap-4"
                      >
                        <dt className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">
                          {spec.label}
                        </dt>
                        <dd className="tnum font-mono text-[11px] text-navy">
                          {spec.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-4 inline-flex items-center gap-1.5 font-body text-xs font-semibold text-royal">
                    Full specification
                    <ArrowUpRight
                      aria-hidden="true"
                      className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    />
                  </p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </Section>
    </section>
  );
}
