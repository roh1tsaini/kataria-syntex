import type { Metadata } from "next";
import { site } from "@/content/site";
import { InquiryForm } from "@/components/contact/InquiryForm";
import { Section } from "@/components/section/Section";
import { PageHead } from "@/components/section/PageHead";
import { Reveal } from "@/components/motion/Reveal";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Send a yarn inquiry to Kataria Syntex — counts, quantity, and destination get you a commercial answer, usually within one working day.",
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product } = await searchParams;

  return (
    <>
      <PageHead
        kicker="Send an inquiry"
        title="Tell us the yarn. We do the rest."
        lede="Counts or denier, quantity, shade, and destination — that is all the desk needs to come back with real options."
      />

      <Section className="pb-16 md:pb-21">
        <div className="grid gap-12 lg:grid-cols-12">
          {/* Form */}
          <Reveal className="lg:col-span-7">
            <InquiryForm key={product ?? ""} initialProduct={product} />
          </Reveal>

          {/* Contact ledger */}
          <Reveal delay={120} className="lg:col-span-5">
            <div className="flex flex-col gap-10">
              <dl className="card-sheen overflow-hidden rounded-card border border-line bg-paper shadow-card">
                {[
                  {
                    label: "Phone",
                    value: site.contact.phone,
                    href: `tel:${site.contact.phoneHref}`,
                  },
                  {
                    label: "WhatsApp",
                    value: "Message the desk",
                    href: site.contact.whatsappHref,
                  },
                  {
                    label: "Email",
                    value: site.contact.email,
                    href: `mailto:${site.contact.email}`,
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-[110px_1fr] gap-4 border-b border-line px-5 py-4 transition-colors last:border-b-0 hover:bg-canvas/50"
                  >
                    <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                      {row.label}
                    </dt>
                    <dd>
                      <a
                        href={row.href}
                        target={
                          row.href.startsWith("http") ? "_blank" : undefined
                        }
                        rel={
                          row.href.startsWith("http") ? "noreferrer" : undefined
                        }
                        className="inline-block break-all py-1 font-mono text-sm text-navy transition-colors hover:text-royal"
                      >
                        {row.value}
                      </a>
                    </dd>
                  </div>
                ))}
                <div className="grid grid-cols-[110px_1fr] gap-4 px-5 py-4">
                  <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                    Address
                  </dt>
                  <dd className="font-mono text-sm">
                    {site.contact.addressLines.join(", ")}
                  </dd>
                </div>
              </dl>

              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  Desk hours
                </p>
                <ul className="mt-3 space-y-2">
                  {site.hours.map((row) => (
                    <li
                      key={row.days}
                      className="flex items-baseline justify-between gap-4 border-b border-line pb-2 text-sm"
                    >
                      <span>{row.days}</span>
                      <span className="tnum font-mono text-xs text-ink-soft">
                        {row.time}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="overflow-hidden rounded-card border border-line shadow-card">
                <iframe
                  title={`Map — ${site.name}, ${site.base}`}
                  src={site.contact.mapEmbedUrl}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="aspect-[4/3] w-full grayscale"
                />
              </div>
            </div>
          </Reveal>
        </div>
      </Section>
    </>
  );
}
