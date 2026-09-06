import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/section/Section";
import { CtaPanel } from "@/components/section/CtaPanel";

/** Closing band — the navy CTA panel floating on the canvas before the footer. */
export function CtaBand() {
  return (
    <section>
      <Section>
        <CtaPanel
          align="center"
          kicker="Start a conversation"
          title="Ready to source the right yarn?"
          lede="Send counts, quantity, and destination. The desk replies with commercial options — usually within one working day."
          actions={
            <>
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
            </>
          }
        />
      </Section>
    </section>
  );
}
