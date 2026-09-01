import { Section } from "@/components/section/Section";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  buyerSegments,
  faqs,
  servicePillars,
  site,
  yearsOfExperience,
} from "@/content/site";
import { SectionHead } from "@/components/section/SectionHead";
import { Reveal } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const metadata: Metadata = {
  title: "About",
  description: `${site.name} — a B2B yarn dealer and sourcing partner in Surat, Gujarat, serving textile businesses since ${site.establishedYear}.`,
};

export default function AboutPage() {
  return (
    <Section>
      {/* Story */}
      <div className="grid gap-10 md:grid-cols-12">
        <SectionHead
          className="md:col-span-7"
          kicker="The house"
          title="A Surat yarn desk, built on repeat business."
          lede={`${site.name} has supplied cotton, polyester, and dyed yarn since ${site.establishedYear}. The business runs on a simple discipline: say what is available, quote what is real, and dispatch what was promised. That is how a dealer becomes a sourcing partner.`}
        />
        <Reveal delay={120} className="md:col-span-5">
          <dl className="overflow-hidden rounded-card border border-line bg-paper shadow-card">
            {[
              { label: "Established", value: String(site.establishedYear) },
              { label: "Trade", value: "B2B yarn supply" },
              { label: "Base", value: site.base },
              { label: "Experience", value: `${yearsOfExperience()}+ years` },
            ].map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-2 gap-4 border-b border-line px-5 py-4 last:border-b-0"
              >
                <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  {row.label}
                </dt>
                <dd className="tnum text-right font-mono text-sm text-navy">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>

      {/* Pillars */}
      <div className="mt-20 md:mt-28">
        <SectionHead
          kicker="How the desk works"
          title="Four working principles."
        />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {servicePillars.map((pillar, index) => (
            <Reveal
              key={pillar.title}
              delay={index * 70}
              className="rounded-card border border-line bg-paper p-6 shadow-card md:p-8"
            >
              <p className="tnum font-mono text-xs text-royal">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-3 font-display text-lg font-semibold tracking-tight text-navy">
                {pillar.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                {pillar.description}
              </p>
            </Reveal>
          ))}
        </div>
      </div>

      {/* Buyer segments */}
      <div className="mt-20 md:mt-28">
        <SectionHead
          kicker="Who we supply"
          title="Built for the people who run production."
        />
        <div className="mt-10 border-t border-line">
          {buyerSegments.map((segment, index) => (
            <Reveal key={segment.title} delay={index * 60}>
              <div className="grid gap-2 border-b border-line py-6 md:grid-cols-12 md:items-baseline">
                <p className="tnum font-mono text-xs text-royal md:col-span-1">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="font-display text-lg font-semibold tracking-tight text-navy md:col-span-4">
                  {segment.title}
                </h3>
                <p className="max-w-xl text-sm leading-relaxed text-ink-soft md:col-span-7">
                  {segment.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* FAQs */}
      <div className="mt-20 grid gap-10 md:mt-28 md:grid-cols-12">
        <SectionHead
          className="md:col-span-4"
          kicker="Straight answers"
          title="Asked before every first order."
        />
        <Reveal delay={100} className="md:col-span-8">
          <Accordion type="single" collapsible className="border-t border-line">
            {faqs.map((faq) => (
              <AccordionItem key={faq.question} value={faq.question}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>

      {/* Close */}
      <Reveal className="mt-20 rounded-panel bg-navy bg-[linear-gradient(120deg,var(--color-navy),var(--color-royal))] p-8 text-center md:mt-28 md:p-14">
        <h2 className="font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
          Talk to the desk directly.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ice-soft">
          No account managers, no ticket queues — the same people who quote your
          yarn follow it to dispatch.
        </p>
        <div className="mt-6">
          <Button asChild variant="on-dark" size="lg">
            <Link href="/contact">
              Send an inquiry
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </Reveal>
    </Section>
  );
}
