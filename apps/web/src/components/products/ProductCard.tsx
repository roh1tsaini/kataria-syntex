import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import type { YarnProduct } from "@kataria-syntex/shared";
import { cn } from "@kataria-syntex/shared";

/**
 * Paper card that lifts on hover — kept next to its two call sites
 * (here + ShadeStrip) instead of a one-export module.
 */
const liftedCard =
  "card-sheen relative rounded-card border border-line bg-paper shadow-card transition-[translate,box-shadow] duration-300 ease-[var(--ease-out)] hover:-translate-y-1 hover:shadow-float";

/**
 * The yarn card used by the home index and the products page — duotone
 * art (grayscale multiplied over royal, so every photo sits inside the
 * blue family), code + family chip, and the three specs a buyer scans
 * first. The whole card is the link.
 */
export function ProductCard({
  product,
  priority = false,
}: {
  product: YarnProduct;
  priority?: boolean;
}) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className={cn("group flex h-full flex-col overflow-hidden", liftedCard)}
    >
      <div className="art-duotone relative aspect-[16/10] overflow-hidden">
        <Image
          src={product.image}
          alt={product.imageAlt}
          fill
          priority={priority}
          sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
          className="art-duotone-img object-cover transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-[1.04]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-6">
        <div className="flex items-baseline justify-between gap-3">
          <p className="tnum font-mono text-[11px] text-ink-soft">
            {product.code}
          </p>
          <p className="rounded-full bg-ice/40 px-2.5 py-0.5 font-body text-[10px] font-bold uppercase tracking-[0.07em] text-royal">
            {product.category}
          </p>
        </div>
        <h3 className="font-display text-xl font-bold tracking-tight text-navy md:text-2xl">
          {product.name}
        </h3>
        <p className="text-sm leading-relaxed text-ink-soft">
          {product.headline}
        </p>
        <dl className="mt-auto space-y-1.5 border-t border-line pt-4">
          {product.specs.slice(0, 3).map((spec) => (
            <div key={spec.label} className="flex justify-between gap-4">
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
            className="size-3.5 transition-transform duration-300 ease-[var(--ease-spring)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </p>
      </div>
    </Link>
  );
}
