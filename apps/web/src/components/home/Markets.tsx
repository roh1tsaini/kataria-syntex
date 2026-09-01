import { Section } from "@/components/section/Section";
import { exportCountries, indianStates } from "@/content/markets";
import { SectionHead } from "@/components/section/SectionHead";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Supply map in type, not clipart — the export book and the domestic
 * book as two paper ledger cards.
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
          <Reveal className="rounded-card border border-line bg-paper p-6 shadow-card md:p-10">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="font-display text-xl font-semibold tracking-tight text-navy">
                Export book
              </h3>
              <p className="tnum font-mono text-[11px] text-ink-soft">
                {exportCountries.length} COUNTRIES
              </p>
            </div>
            <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3">
              {exportCountries.map((country) => (
                <li
                  key={country.code}
                  className="flex items-baseline justify-between gap-2 border-b border-line pb-1.5 font-mono text-xs text-navy"
                >
                  <span>{country.name}</span>
                  <span className="tnum text-[10px] text-ink-soft">
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
            className="rounded-card border border-line bg-paper p-6 shadow-card md:p-10"
          >
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="font-display text-xl font-semibold tracking-tight text-navy">
                Domestic book
              </h3>
              <p className="tnum font-mono text-[11px] text-ink-soft">
                {indianStates.length} STATES
              </p>
            </div>
            <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3">
              {indianStates.map((state) => (
                <li
                  key={state.name}
                  className="flex items-baseline justify-between gap-2 border-b border-line pb-1.5 font-mono text-xs text-navy"
                >
                  <span>{state.name}</span>
                  <span className="tnum text-[10px] text-ink-soft">
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
