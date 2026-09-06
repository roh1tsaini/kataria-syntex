import { Section } from "@/components/section/Section";
import Link from "next/link";
import { site, yearsOfExperience } from "@/content/site";
import { exportCountries } from "@/content/markets";
import { navLinks } from "@/content/nav";

/* Brand glyphs — lucide no longer ships brand icons, so these two live here. */
function InstagramGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function FacebookGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4"
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

export function SiteFooter() {
  const countries = `${exportCountries.length}+`;
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
            <div className="mt-6 flex items-center gap-2">
              <a
                href={site.socials.instagram}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="grid size-10 place-items-center rounded-full border border-line-dark text-cornflower transition-colors duration-200 hover:border-sky/50 hover:text-sky"
              >
                <InstagramGlyph />
              </a>
              <a
                href={site.socials.facebook}
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                className="grid size-10 place-items-center rounded-full border border-line-dark text-cornflower transition-colors duration-200 hover:border-sky/50 hover:text-sky"
              >
                <FacebookGlyph />
              </a>
            </div>
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

      {/* Giant ghost wordmark — full-bleed, uncropped by construction.
          Breathing room lives inside the bed (pb + loose leading), never
          negative margins, so descenders ("y") always clear the edge. */}
      <div aria-hidden="true" className="overflow-hidden">
        <p className="whitespace-nowrap bg-gradient-to-b from-white/[0.09] to-white/[0.03] bg-clip-text pb-[0.16em] text-center font-display text-[clamp(2.75rem,11vw,11rem)] font-bold leading-[1] tracking-tight text-transparent">
          {site.name}
        </p>
      </div>
    </footer>
  );
}
