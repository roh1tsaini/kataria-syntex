/**
 * Yarn catalog.
 * NOTE FOR THE OWNER: counts, denier ranges, packing and MOQ fields are
 * sensible defaults for a Surat yarn desk — edit them to match your actual
 * supply terms. Every spec row renders verbatim on the site.
 */
export interface YarnProduct {
  slug: string;
  code: string;
  name: string;
  category: "Cotton" | "Polyester" | "Dyed";
  headline: string;
  description: string;
  image: string;
  imageAlt: string;
  specs: { label: string; value: string }[];
  features: string[];
  applications: string[];
  featured: boolean;
}

export const products: YarnProduct[] = [
  {
    slug: "combed-cotton-yarn",
    code: "KS-CT-01",
    name: "Combed Cotton Yarn",
    category: "Cotton",
    headline: "Clean, even yarn for fine shirting and knit programs.",
    description:
      "Combed cotton yarn with low imperfection levels for buyers who need a smooth, uniform base for weaving and knitting. Suited to fine fabric construction where hand feel and appearance carry the product.",
    image: "/images/cotton-yarn.png",
    imageAlt: "Cones of natural combed cotton yarn",
    specs: [
      { label: "Composition", value: "100% combed cotton" },
      { label: "Count range", value: "Ne 20 – Ne 40" },
      { label: "Spinning", value: "Ring spun" },
      { label: "Form", value: "Cone, waxed / unwaxed" },
      { label: "Packing", value: "Carton / pp bag, export-grade" },
      { label: "MOQ", value: "On inquiry" },
    ],
    features: [
      "Low hairiness, even surface",
      "Suitable for high-speed looms",
      "Raw white and ready-for-dyeing supply",
      "Consistent lot quality across repeats",
    ],
    applications: ["Shirting", "Fine knits", "Home textiles", "Hosiery"],
    featured: true,
  },
  {
    slug: "carded-cotton-yarn",
    code: "KS-CT-02",
    name: "Carded Cotton Yarn",
    category: "Cotton",
    headline: "Workhorse cotton for denim, drills, and daily production.",
    description:
      "Carded cotton yarn for volume programs where strength, absorbency, and price discipline matter. A dependable base for heavy and medium constructions running on repeat orders.",
    image: "/images/cotton-yarn.png",
    imageAlt: "Carded cotton yarn cones in a mill setting",
    specs: [
      { label: "Composition", value: "100% carded cotton" },
      { label: "Count range", value: "Ne 6 – Ne 30" },
      { label: "Spinning", value: "Ring / open end" },
      { label: "Form", value: "Cone / cheese" },
      { label: "Packing", value: "Carton / pp bag, export-grade" },
      { label: "MOQ", value: "On inquiry" },
    ],
    features: [
      "High absorbency for dyeing and finishing",
      "Strong base for coarse constructions",
      "Volume-friendly commercials",
      "Steady replenishment for running programs",
    ],
    applications: ["Denim", "Drills & twills", "Terry", "Canvas"],
    featured: false,
  },
  {
    slug: "polyester-spun-yarn",
    code: "KS-PL-01",
    name: "Polyester Spun Yarn",
    category: "Polyester",
    headline: "High-tenacity spun yarn built for hard-wearing fabric.",
    description:
      "100% polyester spun yarn with the tensile strength and abrasion resistance production units expect for uniforms, workwear, and blended-fabric programs. Quick-drying and dimensionally stable in finishing.",
    image: "/images/polyester-yarn.png",
    imageAlt: "White polyester spun yarn cones",
    specs: [
      { label: "Composition", value: "100% polyester" },
      { label: "Count range", value: "Ne 20 – Ne 60" },
      { label: "Spinning", value: "Ring spun" },
      { label: "Form", value: "Cone, TFO available" },
      { label: "Packing", value: "Carton / pp bag, export-grade" },
      { label: "MOQ", value: "On inquiry" },
    ],
    features: [
      "High tensile and abrasion strength",
      "Wrinkle and shrink resistant",
      "Uniform for weaving and knitting",
      "Sewing-thread grades on request",
    ],
    applications: ["Workwear", "Uniforms", "Blends", "Sewing thread"],
    featured: true,
  },
  {
    slug: "polyester-dty-yarn",
    code: "KS-PL-02",
    name: "Polyester DTY Yarn",
    category: "Polyester",
    headline: "Textured yarn with the bulk and stretch knits demand.",
    description:
      "Draw-textured polyester yarn for circular knits, warp knits, and activewear programs. Surat's core strength — steady availability across deniers with consistent crimp and dye uptake.",
    image: "/images/polyester-yarn.png",
    imageAlt: "Draw-textured polyester yarn packages",
    specs: [
      { label: "Composition", value: "100% polyester, textured" },
      { label: "Denier range", value: "75D – 300D" },
      { label: "Intermingle", value: "NIM / SIM / HIM" },
      { label: "Form", value: "Cone, dyed or raw white" },
      { label: "Packing", value: "Carton / palletized export" },
      { label: "MOQ", value: "On inquiry" },
    ],
    features: [
      "Soft bulk with elastic recovery",
      "Even dye uptake, low barré risk",
      "Wide denier availability ex-Surat",
      "Dope-dyed blacks on request",
    ],
    applications: ["Circular knits", "Activewear", "Warp knits", "Furnishing"],
    featured: false,
  },
  {
    slug: "dyed-cotton-yarn",
    code: "KS-DY-01",
    name: "Dyed Cotton Yarn",
    category: "Dyed",
    headline: "Shade-true cotton, matched lot to lot for color-critical runs.",
    description:
      "Package-dyed cotton yarn matched to your lab dips and shade-card references. Color-critical programs get controlled dye lots with clear continuity records for reordering.",
    image: "/images/dyed-yarn.png",
    imageAlt: "Dyed cotton yarn in deep shades",
    specs: [
      { label: "Composition", value: "100% cotton, package dyed" },
      { label: "Count range", value: "Ne 10 – Ne 40" },
      { label: "Dye class", value: "Reactive" },
      { label: "Shades", value: "Shade card + custom lab dips" },
      { label: "Packing", value: "Carton / pp bag, export-grade" },
      { label: "MOQ", value: "On inquiry" },
    ],
    features: [
      "Lab-dip matching before bulk",
      "Lot-continuity records for repeats",
      "Good wash and rub fastness",
      "Small lots and bulk both supported",
    ],
    applications: ["Stripes & checks", "Knits", "Socks", "Made-ups"],
    featured: true,
  },
  {
    slug: "dyed-polyester-yarn",
    code: "KS-DY-02",
    name: "Dyed Polyester Yarn",
    category: "Dyed",
    headline: "Deep, fast shades for polyester programs that can't fade.",
    description:
      "Disperse-dyed polyester yarn with strong light and wash fastness for outdoor, suiting, and furnishing programs. Shade-card colors and custom matches available across spun and DTY bases.",
    image: "/images/dyed-yarn.png",
    imageAlt: "Dyed polyester yarn in saturated colors",
    specs: [
      { label: "Composition", value: "100% polyester, package dyed" },
      { label: "Base", value: "Spun Ne 20 – 60 / DTY 75D – 300D" },
      { label: "Dye class", value: "Disperse" },
      { label: "Shades", value: "Shade card + custom lab dips" },
      { label: "Packing", value: "Carton / palletized export" },
      { label: "MOQ", value: "On inquiry" },
    ],
    features: [
      "High light and wash fastness",
      "Deep blacks and brights available",
      "Consistent across spun and DTY bases",
      "Suitable for outdoor and furnishing use",
    ],
    applications: ["Suiting", "Furnishing", "Automotive fabric", "Outdoor"],
    featured: false,
  },
];

export const productCategories = [
  "All",
  ...new Set(products.map((product) => product.category)),
] as const;

export function getProduct(slug: string) {
  return products.find((product) => product.slug === slug);
}
