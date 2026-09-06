import { Section } from "@/components/section/Section";
import { ProductCard } from "@/components/products/ProductCard";
import { SectionHead } from "@/components/section/SectionHead";
import { Reveal } from "@/components/motion/Reveal";
import { products } from "@/content/products";

/**
 * Yarn index — the three material families as lifted paper cards on a
 * recessed blue band.
 */
export function YarnIndex() {
  const families = products.filter((product) => product.featured);

  return (
    <section className="bg-canvas-deep">
      <Section>
        <SectionHead
          kicker="The yarn index"
          title="Three fibers. Every count that matters."
          lede="Each family is stocked across the counts and deniers Surat runs on — open a yarn for the full specification."
        />

        <div className="mt-10 grid gap-5 md:mt-14 md:grid-cols-3">
          {families.map((product, index) => (
            <Reveal key={product.slug} delay={index * 80}>
              <ProductCard product={product} />
            </Reveal>
          ))}
        </div>
      </Section>
    </section>
  );
}
