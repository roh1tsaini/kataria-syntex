import { site } from "./site";

export type CardLink = {
  label: string;
  detail: string;
  href: string;
  external: boolean;
  icon: "globe" | "whatsapp" | "phone" | "pin" | "instagram" | "facebook";
};

export const cardMeta = [
  { term: "Call / WhatsApp", value: site.contact.phone },
  { term: "Email", value: site.contact.email },
  { term: "Web", value: site.url.replace(/^https?:\/\//, "") },
  { term: "Base", value: site.contact.addressLines.slice(0, 2).join(", ") },
] as const;

export const cardLinks: CardLink[] = [
  {
    label: "Website",
    detail: "katariasyntex.com",
    href: site.url,
    external: true,
    icon: "globe",
  },
  {
    label: "WhatsApp",
    detail: site.contact.whatsapp,
    href: site.contact.whatsappHref,
    external: true,
    icon: "whatsapp",
  },
  {
    label: "Call the desk",
    detail: site.contact.phone,
    href: `tel:${site.contact.phoneHref}`,
    external: false,
    icon: "phone",
  },
  {
    label: "Visit us",
    detail: site.contact.addressLines.join(", "),
    href: site.contact.mapsHref,
    external: true,
    icon: "pin",
  },
  {
    label: "Instagram",
    detail: "@katariasyntex",
    href: site.socials.instagram,
    external: true,
    icon: "instagram",
  },
  {
    label: "Facebook",
    detail: "Kataria Syntex",
    href: site.socials.facebook,
    external: true,
    icon: "facebook",
  },
];
