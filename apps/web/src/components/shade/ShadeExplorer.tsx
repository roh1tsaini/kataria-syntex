"use client";

import { FilterPill } from "@/components/ui/filter-pill";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { type Shade } from "@/content/shades";
import { Button } from "@/components/ui/button";
import { YarnSwatch } from "@/components/shade/YarnSwatch";
import { cn } from "@/lib/utils";

/**
 * Interactive shade card — shades grouped into card pages the way the
 * physical card is printed: one panel per page, each shade a wound-yarn
 * band with its code printed beneath. Selecting a shade opens a pulled-out
 * detail strip with its code, hex, and a pre-filled inquiry link. Code
 * search filters across every page at once.
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
  const [selected, setSelected] = useState<Shade | null>(null);

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
    <div className="mt-10 md:mt-14">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div aria-label="Filter by card page" className="flex flex-wrap gap-2">
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

        <label className="flex h-11 min-w-52 items-center gap-2 rounded-control border border-line bg-paper px-3.5 transition-colors focus-within:border-royal">
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

      {/* Selected shade — pulled out of the card like a physical swatch tab */}
      {selected ? (
        <div className="ks-enter mt-6 flex flex-col gap-5 rounded-card border border-line bg-paper p-5 sm:flex-row sm:items-center md:p-6">
          <div className="relative w-full shrink-0 overflow-hidden rounded-chip sm:w-48">
            <YarnSwatch
              colors={selected.colors ?? [selected.hex]}
              rowHeight={13}
              className="h-24 w-full rounded-chip sm:h-20"
            />
            <span className="tnum absolute bottom-2 left-2 rounded-[5px] bg-paper/95 px-2 py-0.5 font-mono text-[10px] font-medium text-navy shadow-card">
              {selected.code}
            </span>
          </div>
          <div>
            <p className="font-body text-[11px] font-bold uppercase tracking-[0.07em] text-royal">
              Selected shade
            </p>
            <p className="tnum mt-1 font-display text-2xl font-bold tracking-tight text-navy">
              Shade {selected.code}
            </p>
            <p className="tnum mt-1 font-mono text-xs text-ink-soft">
              {selected.hex.toUpperCase()} · CARD PAGE {selected.page}
              {selected.colors ? " · MELANGE — MULTI-COLOR THREAD" : ""}
            </p>
          </div>
          <div className="sm:ms-auto">
            <Button asChild variant="primary">
              <Link
                href={`/contact?shade=${encodeURIComponent(selected.code)}`}
              >
                Request this shade
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

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
              {pageShades.map((shade) => {
                const isActive = selected?.code === shade.code;
                return (
                  <button
                    key={`${shade.page}-${shade.code}`}
                    type="button"
                    onClick={() => setSelected(isActive ? null : shade)}
                    aria-pressed={isActive}
                    aria-label={`Shade ${shade.code}, hex ${shade.hex}`}
                    className="group cursor-pointer rounded-chip"
                  >
                    <YarnSwatch
                      colors={shade.colors ?? [shade.hex]}
                      rowHeight={8}
                      className={cn(
                        "aspect-[3/4] w-full transition-[translate,box-shadow] duration-150 ease-[var(--ease-out)] group-hover:-translate-y-0.5",
                        isActive &&
                          "ring-2 ring-royal ring-offset-2 ring-offset-paper",
                      )}
                    />
                    <span
                      className={cn(
                        "tnum mt-1.5 block truncate text-center font-mono text-[10px] transition-colors",
                        isActive
                          ? "font-medium text-navy"
                          : "text-ink-soft group-hover:text-navy",
                      )}
                    >
                      {shade.code}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="mt-6 rounded-card border border-line bg-paper p-6">
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
