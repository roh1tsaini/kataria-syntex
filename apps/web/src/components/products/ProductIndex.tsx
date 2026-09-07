"use client";

import { FilterPill } from "@/components/ui/filter-pill";
import { ProductCard } from "@/components/products/ProductCard";

import { useState } from "react";
import type { YarnProduct } from "@kataria-syntex/shared";
import { Section } from "@/components/section/Section";

/**
 * Filterable yarn ledger — the shared product card on a filterable grid.
 * Filter pills are 44px touch targets; the active one is royal.
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
    <Section className="pb-16 md:pb-21">
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
          <ProductCard
            key={product.slug}
            product={product}
            priority={index < 3}
          />
        ))}
      </div>
    </Section>
  );
}
