"use client";

import Link from "next/link";
import { ArrowLeft, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LinksError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[27rem] flex-1 flex-col justify-center px-4 py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink-soft">
        Unable to load links
      </p>
      <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-navy">
        Something went wrong.
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        Please check your connection and try again.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Button variant="primary" onClick={() => reset()}>
          <RotateCw className="size-4" /> Try again
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
