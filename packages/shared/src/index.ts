export interface CompanyInfo {
  name: string;
  tagline: string;
  established: number;
  location: string;
  phone: string;
  email: string;
}

export const COMPANY_DETAILS: CompanyInfo = {
  name: "Kataria Syntex",
  tagline: "Yarn, sourced straight from Surat.",
  established: 2004,
  location: "Surat, Gujarat, India",
  phone: "+91 93758 30760",
  email: "katariasyntex@gmail.com",
};

export { cn } from "./cn";
export * from "./permissions";
export * from "./errors";
export * from "./challans";
export * from "./numbering";
export * from "./shades";
export * from "./products";
export * from "./validation";
export * from "./math";
export * from "./fy";
export * from "./semver";
