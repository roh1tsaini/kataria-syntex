import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getProduct, products } from "@/content/products";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return {};
  return { title: product.name, description: product.description };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  const inquiryHref = `/contact?product=${encodeURIComponent(product.name)}`;

  return (
    <article className="mx-auto max-w-[1180px] px-4 py-14 sm:px-6 md:py-21 lg:px-8">
      <Link
        href="/products"
        className="inline-flex min-h-[44px] items-center gap-2 py-2 font-mono text-xs text-ink-soft transition-colors hover:text-royal"
      >
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        Back to the yarn index
      </Link>

      <div className="mt-8 grid gap-10 lg:grid-cols-12">
        {/* Visual */}
        <div className="lg:col-span-5">
          <div className="relative aspect-[4/5] overflow-hidden rounded-card border border-line">
            <Image
              src={product.image}
              alt={product.imageAlt}
              fill
              priority
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {product.applications.map((application) => (
              <Badge key={application}>{application}</Badge>
            ))}
          </div>
        </div>

        {/* Specification */}
        <div className="lg:col-span-7">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="tnum font-mono text-xs text-ink-soft">
              {product.code}
            </p>
            <p className="font-body text-xs font-bold uppercase tracking-[0.07em] text-royal">
              {product.category}
            </p>
          </div>
          <h1 className="mt-3 font-display text-4xl font-bold leading-[1.02] tracking-tight text-navy md:text-5xl">
            {product.name}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-soft md:text-lg">
            {product.description}
          </p>

          <dl className="mt-8 border-t border-line">
            {product.specs.map((spec) => (
              <div
                key={spec.label}
                className="grid grid-cols-2 gap-4 border-b border-line py-3.5"
              >
                <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  {spec.label}
                </dt>
                <dd className="tnum text-right font-mono text-sm text-navy">
                  {spec.value}
                </dd>
              </div>
            ))}
          </dl>

          <h2 className="mt-10 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
            What it does well
          </h2>
          <ul className="mt-4 space-y-2.5">
            {product.features.map((feature) => (
              <li
                key={feature}
                className="flex items-baseline gap-3 text-sm leading-relaxed text-navy"
              >
                <span
                  aria-hidden="true"
                  className="size-1 shrink-0 translate-y-[-1px] rounded-full bg-royal"
                />
                {feature}
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild variant="primary" size="lg">
              <Link href={inquiryHref}>
                Inquire about this yarn
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="/shade-card">Match a shade</Link>
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
