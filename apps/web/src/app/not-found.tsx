import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-dvh bg-canvas flex flex-col">
      <SiteHeader />
      <main className="flex-1 grid place-items-center px-6 py-16">
        <div className="max-w-md text-center">
          <p className="font-body text-xs font-bold tracking-[0.12em] text-royal">
            404 — NOT FOUND
          </p>
          <h1 className="mt-3 font-display text-[28px] font-bold tracking-[-0.02em] text-navy">
            This page doesn&apos;t exist.
          </h1>
          <p className="mt-3 font-body text-sm leading-6 text-navy/70">
            The link may be old or mistyped. Try the yarn index or the shade
            card instead.
          </p>
          <Button asChild variant="primary" className="mt-8">
            <Link href="/">
              <ArrowLeft /> Back to the front desk
            </Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
