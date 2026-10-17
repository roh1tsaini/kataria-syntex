"use client";

import Link from "next/link";
import { ArrowLeft, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@kataria-syntex/shared";

/**
 * Route error UI — kicker, headline, message, and the retry + home actions.
 * Copy and container classes come from each route's error.tsx, which stays
 * a thin App Router convention file.
 */
export function RouteError({
  kicker,
  title,
  message,
  retryLabel = "Try again",
  reset,
  className,
}: {
  kicker: string;
  title: string;
  message: string;
  retryLabel?: string;
  reset: () => void;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto text-center", className)}>
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink-soft">
        {kicker}
      </p>
      <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-navy">
        {title}
      </h1>
      <p className="mt-2 text-sm text-ink-soft">{message}</p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Button variant="primary" onClick={() => reset()}>
          <RotateCw className="size-4" /> {retryLabel}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/">
            <ArrowLeft className="size-4" /> Home
          </Link>
        </Button>
      </div>
    </div>
  );
}
