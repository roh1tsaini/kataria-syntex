"use client";

import Link from "next/link";
import { ArrowLeft, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/section/Section";

export default function ContactError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Section className="py-16 text-center">
      <div className="mx-auto max-w-md">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink-soft">
          Contact Desk
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-navy">
          Couldn&apos;t load the contact form.
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Something interrupted loading. You can retry or reach us directly.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="primary" onClick={() => reset()}>
            <RotateCw className="size-4" /> Retry
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">
              <ArrowLeft className="size-4" /> Home
            </Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}
