"use client";

import { FilterPill } from "@/components/ui/filter-pill";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { type Shade } from "@/content/shades";
import { Button } from "@/components/ui/button";
import { YarnSwatch } from "@/components/shade/YarnSwatch";

/**
 * Interactive shade card — shades grouped into card pages the way the
 * physical card is printed: one panel per page, each shade a wound-yarn
 * band with its code printed beneath. Code search filters across every
 * page at once.
 */
export function ShadeExplorer({
  shades,
  pages,
}: {
  shades: Shade[];
  pages: number[];
}) {
  const [activePage, setActivePage] = useState<number | "all">("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return shades.filter((shade) => {
      if (activePage !== "all" && shade.page !== activePage) return false;
      if (term && !shade.code.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [shades, activePage, query]);

  const grouped = useMemo(
    () =>
      pages
        .map((page) => ({
          page,
          shades: visible.filter((shade) => shade.page === page),
        }))
        .filter((group) => group.shades.length > 0),
    [pages, visible],
  );

  return (
    <div className="mt-10 md:mt-12">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div
          role="group"
          aria-label="Filter by card page"
          className="flex flex-wrap gap-2"
        >
          <FilterPill
            active={activePage === "all"}
            onClick={() => setActivePage("all")}
          >
            All pages
          </FilterPill>
          {pages.map((page) => (
            <FilterPill
              key={page}
              active={activePage === page}
              onClick={() => setActivePage(page)}
              className="tnum"
            >
              Page {page}
            </FilterPill>
          ))}
        </div>

        <label className="flex h-11 w-full min-w-52 items-center gap-2 rounded-full border border-line bg-paper px-4 shadow-xs transition-[border-color,box-shadow] focus-within:border-royal focus-within:shadow-[0_0_0_3px_rgb(30_58_138/0.12)] sm:w-auto sm:flex-1 lg:flex-none">
          <Search aria-hidden="true" className="size-4 text-ink-soft" />
          <span className="sr-only">Search by shade code</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search code — e.g. 88L"
            className="w-full bg-transparent py-2 font-mono text-sm placeholder:text-ink-soft/60 focus:outline-none"
          />
        </label>
      </div>

      {/* Count */}
      <p
        aria-live="polite"
        className="tnum mt-8 font-mono text-[11px] text-ink-soft"
      >
        {visible.length} OF {shades.length} SHADES
      </p>

      {/* Card pages */}
      <div className="mt-3 space-y-10">
        {grouped.map(({ page, shades: pageShades }) => (
          <section key={page} aria-label={`Card page ${page}`}>
            <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
              <h3 className="font-display text-lg font-semibold tracking-tight text-navy">
                Card page {page}
              </h3>
              <p className="tnum font-mono text-[11px] text-ink-soft">
                {pageShades.length} SHADES
              </p>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-x-2 gap-y-3 xs:grid-cols-6 sm:grid-cols-8 md:grid-cols-10 xl:grid-cols-12">
              {pageShades.map((shade) => (
                <span
                  key={`${shade.page}-${shade.code}`}
                  className="group block rounded-chip transition-transform duration-300 ease-[var(--ease-out)] hover:-translate-y-0.5"
                >
                  <YarnSwatch
                    colors={shade.colors ?? [shade.hex]}
                    rowHeight={8}
                    seed={shade.code}
                    className="aspect-[3/4] w-full"
                  />
                  <span className="tnum mt-1.5 block truncate text-center font-mono text-[10px] text-ink-soft transition-colors group-hover:text-royal">
                    {shade.code}
                  </span>
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="card-sheen mt-6 rounded-card border border-line bg-paper p-6 shadow-card">
          <p className="font-mono text-sm text-ink-soft">
            No shade matches “{query}”. Check the code on your physical card, or
            send us the shade you need — custom lab dips are part of the job.
          </p>
          <div className="mt-4">
            <Button asChild variant="primary" size="sm">
              <Link href="/contact">Ask for a custom shade</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
