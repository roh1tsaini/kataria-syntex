import type { Metadata } from "next";
import { BusinessCard } from "@/components/links/BusinessCard";
import { cardLinks, cardMeta } from "@/content/links";
import { site } from "@/content/site";
import { openStatus } from "@/lib/hours";

/**
 * Standalone digital business card (link-in-bio). Lives outside the
 * (main) route group, so it renders without the site header/footer.
 * Dynamic so the open/closed status is computed per request.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Links & contact",
  description: `Reach ${site.name} — website, WhatsApp, phone, directions, Instagram and Facebook, straight from Surat.`,
};

export default function LinksPage() {
  return (
    <main id="main" className="flex flex-1 flex-col">
      <BusinessCard
        name={site.name}
        tagline={site.tagline}
        meta={cardMeta}
        status={openStatus()}
        links={cardLinks}
      />
    </main>
  );
}
