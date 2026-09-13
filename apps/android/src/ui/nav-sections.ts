/**
 * Android navigation config — the phone counterpart of apps/app's
 * `nav-config.tsx`. Same section titles, item labels, sub-item labels and
 * permission sets, mapped onto the Android route table. One table feeds the
 * drawer, so gating and copy can't drift from the web sidebar.
 */

import type { Permission } from "@kataria-syntex/app-core";
import type { FeatherIconName } from "@/ui/feather";

export type SubNavItem = { to: string; label: string };
export type NavItem = {
  to: string;
  label: string;
  icon: FeatherIconName;
  /** Any-of semantics, exactly as the web config. Empty = always shown. */
  permissions: Permission[];
  /** Route matches exactly (no child routes), e.g. the dashboard. */
  end?: boolean;
  subItems?: SubNavItem[];
};
export type NavSection = { title: string; items: NavItem[] };

const CHALLAN_PERMS: Permission[] = [
  "create_challan",
  "edit_challan",
  "delete_challan",
];

export const SECTIONS: NavSection[] = [
  {
    title: "Operations",
    items: [
      {
        to: "/(tabs)",
        label: "Dashboard",
        icon: "home",
        permissions: ["view_reports", "view_stock"],
        end: true,
      },
      {
        to: "/challans",
        label: "Challans",
        icon: "file-text",
        permissions: CHALLAN_PERMS,
        subItems: [
          { to: "/challans", label: "Sales Challans" },
          { to: "/outward", label: "Job-Work Challans" },
        ],
      },
      {
        to: "/returns",
        label: "Returns",
        icon: "corner-down-left",
        permissions: ["create_return", "edit_return"],
      },
      {
        to: "/raw-material",
        label: "Raw Material",
        icon: "box",
        permissions: ["create_raw_material", "edit_raw_material"],
      },
    ],
  },
  {
    title: "Stock",
    items: [
      {
        to: "/stock?kind=raw",
        label: "Raw Stock",
        icon: "database",
        permissions: ["view_stock"],
      },
      {
        to: "/stock?kind=dyed",
        label: "Dyed Stock",
        icon: "layers",
        permissions: ["view_stock"],
      },
      {
        to: "/packing",
        label: "Packing",
        icon: "package",
        permissions: ["create_packing", "edit_packing"],
        subItems: [
          { to: "/packing?type=sale", label: "Final Yarn" },
          { to: "/packing?type=job_work", label: "Raw Yarn" },
        ],
      },
    ],
  },
  {
    title: "Reports",
    items: [
      {
        to: "/reports?report=job-work-balance",
        label: "Job-Work Balance",
        icon: "bar-chart-2",
        permissions: ["view_reports"],
      },
      {
        to: "/reports?report=over-receipts",
        label: "Over-Receipts",
        icon: "alert-triangle",
        permissions: ["view_reports"],
      },
      {
        to: "/reports?report=stock-summary",
        label: "Stock Summary",
        icon: "clipboard",
        permissions: ["view_reports"],
      },
      {
        to: "/reports?report=sales-register",
        label: "Sales Register",
        icon: "file-text",
        permissions: ["view_reports"],
      },
      {
        to: "/reports?report=job-work-register",
        label: "Job-Work Register",
        icon: "settings",
        permissions: ["view_reports"],
      },
      {
        to: "/reports?report=transaction-log",
        label: "Transaction Log",
        icon: "git-branch",
        permissions: ["view_reports"],
      },
      {
        to: "/reports?report=party-summary",
        label: "Party Summary",
        icon: "users",
        permissions: ["view_reports"],
      },
    ],
  },
  {
    title: "Color Organiser",
    items: [
      {
        to: "/colors",
        label: "Colors & Recipes",
        icon: "droplet",
        permissions: ["manage_masters"],
      },
    ],
  },
  {
    title: "Masters",
    items: [
      {
        to: "/masters",
        label: "Master Data",
        icon: "book-open",
        permissions: ["manage_masters"],
        subItems: [
          { to: "/masters?tab=customers", label: "Customers" },
          { to: "/masters?tab=jobWorkers", label: "Job Workers" },
          { to: "/masters?tab=suppliers", label: "Suppliers" },
          { to: "/masters?tab=deniers", label: "Deniers" },
        ],
      },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        to: "/members",
        label: "Team & Members",
        icon: "users",
        permissions: ["manage_members"],
      },
      {
        to: "/devices",
        label: "Connected Devices",
        icon: "smartphone",
        permissions: ["manage_settings"],
      },
      {
        to: "/settings",
        label: "Company Settings",
        icon: "settings",
        permissions: ["manage_settings"],
      },
    ],
  },
];

export const PACKER_SECTIONS: NavSection[] = [
  {
    title: "Operations",
    items: [
      {
        to: "/packing",
        label: "Packing Mode",
        icon: "package",
        permissions: ["create_packing"],
        end: true,
        subItems: [
          { to: "/packing?type=sale", label: "Final Yarn" },
          { to: "/packing?type=job_work", label: "Raw Yarn" },
        ],
      },
    ],
  },
];

/** Search params as expo-router hands them over — values may repeat. */
export type NavParams = Record<string, string | string[] | undefined>;

function matchQuery(to: string, pathname: string, params: NavParams): boolean {
  const [path, query] = to.split("?");
  if (pathname !== path) return false;
  for (const [key, value] of new URLSearchParams(query)) {
    const actual = params[key];
    const flat = Array.isArray(actual) ? actual[0] : actual;
    if (flat !== value) return false;
  }
  return true;
}

export function isItemActive(
  item: NavItem,
  pathname: string,
  params: NavParams,
): boolean {
  // Items with children are toggle buttons on both apps — never the active row.
  if (item.subItems?.length) return false;
  if (item.to === "/(tabs)") return pathname === "/" || pathname === "/(tabs)";
  if (item.to.includes("?")) return matchQuery(item.to, pathname, params);
  return item.end
    ? pathname === item.to
    : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function isSubActive(
  sub: SubNavItem,
  pathname: string,
  params: NavParams,
): boolean {
  if (sub.to.includes("?")) return matchQuery(sub.to, pathname, params);
  return pathname === sub.to || pathname.startsWith(`${sub.to}/`);
}
