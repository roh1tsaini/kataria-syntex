import { Section } from "@/components/section/Section";
import { processSteps } from "@/content/site";
import { SectionHead } from "@/components/section/SectionHead";
import { Reveal } from "@/components/motion/Reveal";

/** How an inquiry moves — navy band, three numbered rows. */
export function Process() {
  return (
    <section className="bg-navy">
      <Section>
        <SectionHead
          invert
          kicker="From inquiry to dispatch"
          title="Three steps, no catalogue maze."
        />
        <div className="mt-10 border-t border-line-dark md:mt-14">
          {processSteps.map((step, index) => (
            <Reveal key={step.step} delay={index * 80}>
              <div className="grid gap-3 border-b border-line-dark py-7 md:grid-cols-12 md:items-baseline md:py-9">
                <p className="tnum font-mono text-3xl text-sky md:col-span-2 md:text-4xl">
                  {step.step}
                </p>
                <h3 className="font-display text-xl font-semibold tracking-tight text-white md:col-span-4 md:text-2xl">
                  {step.title}
                </h3>
                <p className="max-w-xl text-sm leading-relaxed text-ice-soft md:col-span-6 md:text-base">
                  {step.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>
    </section>
  );
}
