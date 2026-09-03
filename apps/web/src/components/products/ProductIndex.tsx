"use client";
import { FilterPill } from "@/components/ui/filter-pill";
import { liftedCard } from "@/components/ui/lifted-card";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import type { YarnProduct } from "@/content/products";
import { cn } from "@/lib/utils";

/**
 * Filterable yarn ledger — lifted paper cards with image, code, and the
 * three specs a buyer scans first. Filter pills are 44px touch targets;
 * the active one is royal.
 */
export function ProductIndex({
  products,
  categories,
}: {
  products: YarnProduct[];
  categories: string[];
}) {
  const [category, setCategory] = useState("All");
  const visible =
    category === "All"
      ? products
      : products.filter((product) => product.category === category);

  return (
    <div className="mt-10 md:mt-14">
      <div
        role="group"
        aria-label="Filter by fiber family"
        className="flex flex-wrap gap-2"
      >
        {categories.map((item) => (
          <FilterPill
            key={item}
            active={category === item}
            onClick={() => setCategory(item)}
          >
            {item}
          </FilterPill>
        ))}
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((product, index) => (
          <Link
            key={product.slug}
            href={`/products/${product.slug}`}
            className={cn("group flex flex-col overflow-hidden", liftedCard)}
          >
            <div className="relative aspect-[16/10] overflow-hidden">
              <Image
                src={product.image}
                alt={product.imageAlt}
                fill
                priority={index < 3}
                sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
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
              <h2 className="font-display text-xl font-bold tracking-tight text-navy">
                {product.name}
              </h2>
              <dl className="mt-auto space-y-1.5 border-t border-line pt-4">
                {product.specs.slice(0, 3).map((spec) => (
                  <div key={spec.label} className="flex justify-between gap-4">
                    <dt className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">
                      {spec.label}
                    </dt>
                    <dd className="tnum text-right font-mono text-[11px] text-navy">
                      {spec.value}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 inline-flex items-center gap-1.5 font-body text-xs font-semibold text-royal">
                Full specification
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
