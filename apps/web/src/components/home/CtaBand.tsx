import { Section } from "@/components/section/Section";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/Reveal";

/** Closing band — navy→royal gradient, one question, one action. */
export function CtaBand() {
  return (
    <section className="bg-navy bg-[linear-gradient(120deg,var(--color-navy),var(--color-royal))]">
      <Section>
        <Reveal>
          <p className="font-body text-[11px] font-bold uppercase tracking-[0.07em] text-sky">
            Start a conversation
          </p>
          <h2 className="mt-4 max-w-3xl font-display text-[clamp(1.75rem,3.5vw,2.75rem)] font-bold leading-[1.05] tracking-tight text-white">
            Ready to source the right yarn?
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-ice-soft">
            Send counts, quantity, and destination. The desk replies with
            commercial options — usually within one working day.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="on-dark" size="lg">
              <Link href="/contact">
                Send an inquiry
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="text-cornflower"
            >
              <Link href="/products">Browse the yarns first</Link>
            </Button>
          </div>
        </Reveal>
      </Section>
    </section>
  );
}
