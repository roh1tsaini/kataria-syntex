import type { Metadata } from "next";
import { shades, shadePages } from "@kataria-syntex/shared";
import { ShadeExplorer } from "@/components/shade/ShadeExplorer";
import { PageHead } from "@/components/section/PageHead";
import { Section } from "@/components/section/Section";

export const metadata: Metadata = {
  title: "Shade Card",
  description: `The Kataria Syntex shade card — ${shades.length} dyed yarn shades transcribed from the physical card. Search by code and request any shade.`,
};

export default function ShadeCardPage() {
  return (
    <>
      <PageHead
        kicker="RAJ shade card"
        title="Every shade, by the number."
        lede={`${shades.length} shades across card pages ${shadePages[0]}–${shadePages[shadePages.length - 1]}, wound as yarn the way the physical card carries them. Select a shade for its code and hex, or search a code directly. Screen colors are indicative — physical lots are matched on lab dips.`}
      />
      <Section className="pb-16 md:pb-21">
        <ShadeExplorer shades={shades} pages={shadePages} />
      </Section>
    </>
  );
}
