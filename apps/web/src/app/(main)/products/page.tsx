import type { Metadata } from "next";
import { products, productCategories } from "@/content/products";
import { ProductIndex } from "@/components/products/ProductIndex";
import { PageHead } from "@/components/section/PageHead";

export const metadata: Metadata = {
  title: "Yarns",
  description:
    "Cotton, polyester, and dyed yarn from Surat — counts, deniers, packing, and applications for each product in the index.",
};

export default function ProductsPage() {
  return (
    <>
      <PageHead
        kicker="The yarn index"
        title="Every yarn, fully specified."
        lede={`${products.length} yarns across ${productCategories.length - 1} fiber families. Open any cell for the complete specification, or filter by family.`}
      />
      <ProductIndex products={products} categories={[...productCategories]} />
    </>
  );
}
