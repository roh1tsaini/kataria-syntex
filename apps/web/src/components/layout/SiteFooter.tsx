import { Section } from "@/components/section/Section";
import Link from "next/link";
import { site, trustMetrics, yearsOfExperience } from "@/content/site";
import { navLinks } from "@/content/nav";

export function SiteFooter() {
  const countries =
    trustMetrics.find((m) => m.label === "export countries served")?.value ??
    "20+";
  return (
    <footer className="bg-navy text-ice-soft">
      <Section>
        <div className="grid gap-12 md:grid-cols-12">
          {/* Wordmark + trade summary */}
          <div className="md:col-span-5">
            <p className="font-display text-3xl font-bold leading-none tracking-tight text-paper md:text-4xl">
              {site.name}
            </p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed">
              <span className="tnum">{yearsOfExperience()}+</span> years
              supplying cotton, polyester, and dyed yarn from Surat to weaving
              units, exporters, and garment teams across India and{" "}
              <span className="tnum">{countries}</span> countries.
            </p>
          </div>

          {/* Contact */}
          <div className="md:col-span-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ice-soft/60">
              Talk to the desk
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a
                  href={`tel:${site.contact.phoneHref}`}
                  className="tnum text-cornflower transition-colors hover:text-sky"
                >
                  {site.contact.phone}
                </a>
              </li>
              <li>
                <a
                  href={site.contact.whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cornflower transition-colors hover:text-sky"
                >
                  WhatsApp the desk
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${site.contact.email}`}
                  className="break-all text-cornflower transition-colors hover:text-sky"
                >
                  {site.contact.email}
                </a>
              </li>
              <li className="pt-2">{site.contact.addressLines.join(", ")}</li>
            </ul>
          </div>

          {/* Hours */}
          <div className="md:col-span-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ice-soft/60">
              Desk hours
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {site.hours.map((row) => (
                <li key={row.days}>
                  <span className="block text-paper">{row.days}</span>
                  <span className="tnum font-mono text-xs text-ice-soft/60">
                    {row.time}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Index */}
          <div className="md:col-span-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ice-soft/60">
              Index
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-cornflower transition-colors hover:text-sky"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 border-t border-line-dark pt-6 font-mono text-[11px] tracking-wide text-ice-soft/60">
          <p>
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
        </div>
      </Section>
    </footer>
  );
}
