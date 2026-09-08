import { useCallback } from "react";
import {
  AlertTriangle,
  BookOpen,
  Boxes,
  ClipboardList,
  Factory,
  FileText,
  Layers,
  LayoutDashboard,
  ListTree,
  MonitorSmartphone,
  Package,
  PackageOpen,
  Palette,
  Receipt,
  Scale,
  Settings,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { useAuth, type Permission } from "@kataria-syntex/app-core";
export type SubNavItem = { to: string; label: string };
export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  permissions: Permission[];
  end?: boolean;
  subItems?: SubNavItem[];
};
export type NavSection = { title: string; items: NavItem[] };

export const SECTIONS: NavSection[] = [
  {
    title: "Operations",
    items: [
      {
        to: "/",
        label: "Dashboard",
        icon: LayoutDashboard,
        permissions: ["view_reports", "view_stock"],
        end: true,
      },
      {
        to: "/challans",
        label: "Challans",
        icon: FileText,
        permissions: ["create_challan", "edit_challan", "delete_challan"],
        subItems: [
          { to: "/challans", label: "Sales Challans" },
          { to: "/outward", label: "Job-Work Challans" },
        ],
      },
      {
        to: "/returns",
        label: "Returns",
        icon: PackageOpen,
        permissions: ["create_return", "edit_return"],
      },
      {
        to: "/raw-material",
        label: "Raw Material",
        icon: Boxes,
        permissions: ["create_raw_material", "edit_raw_material"],
      },
    ],
  },
  {
    title: "Stock",
    items: [
      {
        to: "/stock/raw",
        label: "Raw Stock",
        icon: Warehouse,
        permissions: ["view_stock"],
      },
      {
        to: "/stock/dyed",
        label: "Dyed Stock",
        icon: Layers,
        permissions: ["view_stock"],
      },
      {
        to: "/packing",
        label: "Packing",
        icon: Package,
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
        to: "/reports/job-work-balance",
        label: "Job-Work Balance",
        icon: Scale,
        permissions: ["view_reports"],
      },
      {
        to: "/reports/over-receipts",
        label: "Over-Receipts",
        icon: AlertTriangle,
        permissions: ["view_reports"],
      },
      {
        to: "/reports/stock-summary",
        label: "Stock Summary",
        icon: ClipboardList,
        permissions: ["view_reports"],
      },
      {
        to: "/reports/sales-register",
        label: "Sales Register",
        icon: Receipt,
        permissions: ["view_reports"],
      },
      {
        to: "/reports/job-work-register",
        label: "Job-Work Register",
        icon: Factory,
        permissions: ["view_reports"],
      },
      {
        to: "/reports/transaction-log",
        label: "Transaction Log",
        icon: ListTree,
        permissions: ["view_reports"],
      },
      {
        to: "/reports/party-summary",
        label: "Party Summary",
        icon: Users,
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
        icon: Palette,
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
        icon: BookOpen,
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
        icon: Users,
        permissions: ["manage_members"],
      },
      {
        to: "/devices",
        label: "Connected Devices",
        icon: MonitorSmartphone,
        permissions: ["manage_settings"],
      },
      {
        to: "/settings",
        label: "Company Settings",
        icon: Settings,
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
        icon: Package,
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

/* Bottom tab bar (design.md §4): the four primary destinations + More.
   Same labels/icons as the sidebar. */
export const BOTTOM_ITEMS: Array<{
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  permissions?: Permission[];
}> = [
  { to: "/", label: "Home", icon: LayoutDashboard, end: true },
  {
    to: "/challans",
    label: "Challans",
    icon: FileText,
    permissions: ["create_challan", "edit_challan", "delete_challan"],
  },
  {
    to: "/outward",
    label: "Job work",
    icon: Factory,
    permissions: ["create_challan", "edit_challan", "delete_challan"],
  },
  {
    to: "/packing",
    label: "Packing",
    icon: Package,
    permissions: ["create_packing", "edit_packing"],
  },
];

export const SIDEBAR_STORAGE_KEY = "kataria-sidebar-collapsed";

export function isItemActive(item: NavItem, pathname: string): boolean {
  return item.end
    ? pathname === item.to
    : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function isSubActive(
  sub: SubNavItem,
  pathname: string,
  search: string,
): boolean {
  const [path, query] = sub.to.split("?");
  if (query) return pathname === path && search === `?${query}`;
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** Whether the signed-in workspace may see a nav item gated on `permissions`.
 * Nav must never advertise routes the member can't open. */
export function useCanSee(): (permissions?: Permission[]) => boolean {
  const workspace = useAuth((s) => s.workspace);
  return useCallback(
    (permissions) => {
      if (!workspace) return false;
      if (workspace.isPrimaryAdmin) return true;
      if (!permissions) return true;
      return permissions.some((p) => workspace.permissions.includes(p));
    },
    [workspace],
  );
}
