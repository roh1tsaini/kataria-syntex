"use client";

import { RouteError } from "@/components/section/RouteError";
import { Section } from "@/components/section/Section";

export default function ContactError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Section className="py-16">
      <RouteError
        kicker="Contact Desk"
        title="Couldn't load the contact form."
        message="Something interrupted loading. You can retry or reach us directly."
        retryLabel="Retry"
        reset={reset}
        className="max-w-md"
      />
    </Section>
  );
}
