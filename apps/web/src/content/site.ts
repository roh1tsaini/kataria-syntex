import { COMPANY_DETAILS } from "@kataria-syntex/shared";
import { exportCountries, indianStates } from "./markets";

// The core identity (name, tagline, established year, location, phone,
// email) comes from packages/shared — the single source of truth for
// company facts across the monorepo. Everything else lives here.
const phoneDigits = COMPANY_DETAILS.phone.replace(/\D/g, "");

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://web.katariasyntex.workers.dev"
).replace(/\/+$/, "");

/**
 * Core business information for Kataria Syntex.
 * Edit values in packages/shared; every page reads from this single source.
 */
export const site = {
  name: COMPANY_DETAILS.name,
  tagline: COMPANY_DETAILS.tagline,
  url: siteUrl,
  establishedYear: COMPANY_DETAILS.established,
  base: COMPANY_DETAILS.location,
  city: COMPANY_DETAILS.location.split(",")[0],
  overview:
    "Kataria Syntex is a B2B yarn dealer and sourcing partner for textile businesses that need dependable supply, practical communication, and commercially clear decisions.",
  contact: {
    phone: COMPANY_DETAILS.phone,
    phoneHref: `+${phoneDigits}`,
    whatsapp: COMPANY_DETAILS.phone,
    whatsappHref: `https://wa.me/${phoneDigits}`,
    email: COMPANY_DETAILS.email,
    addressLines: COMPANY_DETAILS.location.split(", "),
    mapsHref:
      "https://www.google.com/maps/search/?api=1&query=Kataria+Syntex,+Surat,+Gujarat,+India",
    mapEmbedUrl:
      "https://maps.google.com/maps?q=Kataria+Syntex,+Surat,+Gujarat,+India&output=embed",
    coords: "21.17°N 72.83°E",
  },
  hours: [
    { days: "Monday – Friday", time: "9:00 AM – 7:00 PM" },
    { days: "Saturday", time: "9:00 AM – 5:00 PM" },
    { days: "Sunday", time: "Closed" },
  ],
  /**
   * Machine-readable twin of `hours` for openStatus(): one entry per
   * weekday (index 0 = Sunday), open/close as 24h "HH:MM", null when
   * closed all day. Edit both together — `hours` is display, this is logic.
   */
  schedule: [
    null,
    { open: "09:00", close: "19:00" },
    { open: "09:00", close: "19:00" },
    { open: "09:00", close: "19:00" },
    { open: "09:00", close: "19:00" },
    { open: "09:00", close: "19:00" },
    { open: "09:00", close: "17:00" },
  ] as const,
  socials: {
    instagram: "https://www.instagram.com/katariasyntex",
    facebook: "https://www.facebook.com/katariasyntex",
  },
} as const;

export function yearsOfExperience(): number {
  return new Date().getFullYear() - site.establishedYear;
}

const highDemandStates = indianStates.filter((s) => s.demand === "high").length;

export const trustMetrics = [
  { value: `${yearsOfExperience()}+`, label: "years in the yarn trade" },
  { value: `${exportCountries.length}+`, label: "export countries served" },
  { value: `${highDemandStates}+`, label: "high-demand Indian states" },
  { value: "01", label: "point of contact, start to dispatch" },
] as const;

export const processSteps = [
  {
    step: "01",
    title: "Share your requirement",
    description:
      "Send yarn type, quantity, end use, and destination through the inquiry form or WhatsApp.",
  },
  {
    step: "02",
    title: "Shortlist the right option",
    description:
      "We narrow the selection on availability, application, and commercial fit — not a generic price list.",
  },
  {
    step: "03",
    title: "Confirm and move to dispatch",
    description:
      "Once aligned, we coordinate supply and delivery with clear communication at every step.",
  },
] as const;

export const servicePillars = [
  {
    title: "Commercially clear quotes",
    description:
      "Share the yarn type, quantity, and destination. We respond with options that fit the requirement instead of generic pricing.",
  },
  {
    title: "Quality-minded sourcing",
    description:
      "The focus stays on yarn suitability, repeatability, and the downstream performance textile teams care about.",
  },
  {
    title: "Domestic and export-ready supply",
    description:
      "From Surat dispatch coordination to export documentation, the supply process stays practical and visible.",
  },
  {
    title: "Long-term partner mindset",
    description:
      "The goal is steady business and dependable reordering, not one-time transactions with weak after-sales support.",
  },
] as const;

export const buyerSegments = [
  {
    title: "Weaving & knitting units",
    description:
      "Yarn options that support repeat production cycles, lot consistency, and commercial clarity.",
  },
  {
    title: "Fabric exporters",
    description:
      "Sourcing support for buyers who need dispatch planning and clear communication from Surat.",
  },
  {
    title: "Garment & hosiery teams",
    description:
      "Reliable cotton, polyester, and dyed yarn selected around fabric use and finish expectations.",
  },
  {
    title: "Trading & procurement desks",
    description:
      "Direct conversations around counts, colors, quantities, and replenishment instead of catalog-only selling.",
  },
] as const;

export const faqs = [
  {
    question: "Is this an ecommerce website?",
    answer:
      "No. Kataria Syntex uses this website as a B2B showcase. Quotes, pricing, and final order discussions happen directly with the team.",
  },
  {
    question: "Do you handle bulk and repeat orders?",
    answer:
      "Yes. The business is structured around wholesale and ongoing supply needs for textile businesses, traders, and manufacturers.",
  },
  {
    question: "Do you serve buyers outside India?",
    answer:
      "Yes. Kataria Syntex supplies across India and works with international buyers from multiple export markets.",
  },
  {
    question: "What should I share to get a faster quote?",
    answer:
      "The most useful inputs are yarn type, quantity, color or finish preference, and your delivery location.",
  },
] as const;
