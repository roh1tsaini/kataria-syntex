import { Section } from "@/components/section/Section";
import { Globe2, MapPin } from "lucide-react";
import { exportCountries, indianStates } from "@/content/markets";
import { SectionHead } from "@/components/section/SectionHead";
import { Reveal } from "@/components/motion/Reveal";
import { cn } from "@kataria-syntex/shared";

const demandTone: Record<string, string> = {
  high: "bg-sky/80",
  medium: "bg-royal/60",
  low: "bg-ink-soft/40",
};

/**
 * Supply map in type, not clipart — the export book and the domestic
 * book as two paper ledger cards with icon chips and live-feeling rows.
 */
export function Markets() {
  return (
    <section>
      <Section>
        <SectionHead
          kicker="Where the yarn goes"
          title="One desk, two supply books."
          lede="Domestic programs ship from Surat daily; export programs move with full documentation support."
        />

        <div className="mt-10 grid gap-5 md:mt-14 md:grid-cols-2">
          <Reveal className="card-sheen rounded-card border border-line bg-paper p-6 shadow-card transition-[translate,box-shadow] duration-300 ease-[var(--ease-out)] hover:-translate-y-1 hover:shadow-float md:p-10">
            <div className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="grid size-11 shrink-0 place-items-center rounded-control border border-line bg-ice/40 text-royal"
              >
                <Globe2 className="size-5" />
              </span>
              <div>
                <h3 className="font-display text-xl font-semibold tracking-tight text-navy">
                  Export book
                </h3>
                <p className="tnum mt-0.5 font-mono text-[11px] text-ink-soft">
                  {exportCountries.length} COUNTRIES
                </p>
              </div>
            </div>
            <ul className="mt-7 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3">
              {exportCountries.map((country) => (
                <li
                  key={country.code}
                  className="flex items-baseline justify-between gap-2 border-b border-line pb-1.5 font-mono text-xs text-navy transition-colors hover:border-royal/40"
                >
                  <span>{country.name}</span>
                  <span className="tnum flex items-center gap-1.5 text-[10px] text-ink-soft">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-1.5 rounded-full",
                        demandTone[country.volume],
                      )}
                    />
                    {country.volume === "high"
                      ? "REGULAR"
                      : country.volume === "medium"
                        ? "ACTIVE"
                        : "ON REQ"}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal
            delay={100}
            className="card-sheen rounded-card border border-line bg-paper p-6 shadow-card transition-[translate,box-shadow] duration-300 ease-[var(--ease-out)] hover:-translate-y-1 hover:shadow-float md:p-10"
          >
            <div className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="grid size-11 shrink-0 place-items-center rounded-control border border-line bg-ice/40 text-royal"
              >
                <MapPin className="size-5" />
              </span>
              <div>
                <h3 className="font-display text-xl font-semibold tracking-tight text-navy">
                  Domestic book
                </h3>
                <p className="tnum mt-0.5 font-mono text-[11px] text-ink-soft">
                  {indianStates.length} STATES
                </p>
              </div>
            </div>
            <ul className="mt-7 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3">
              {indianStates.map((state) => (
                <li
                  key={state.name}
                  className="flex items-baseline justify-between gap-2 border-b border-line pb-1.5 font-mono text-xs text-navy transition-colors hover:border-royal/40"
                >
                  <span>{state.name}</span>
                  <span className="tnum flex items-center gap-1.5 text-[10px] text-ink-soft">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-1.5 rounded-full",
                        demandTone[state.demand],
                      )}
                    />
                    {state.demand === "high"
                      ? "DAILY"
                      : state.demand === "medium"
                        ? "WEEKLY"
                        : "ON REQ"}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Section>
    </section>
  );
}
