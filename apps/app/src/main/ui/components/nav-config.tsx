import {
  Home,
  MonitorSmartphone,
  Settings,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
};
export type NavSection = { title: string; items: NavItem[] };

export const SECTIONS: NavSection[] = [
  {
    title: "General",
    items: [
      {
        to: "/",
        label: "Home",
        icon: Home,
        end: true,
      },
      {
        to: "/devices",
        label: "Connected Devices",
        icon: MonitorSmartphone,
      },
      {
        to: "/settings",
        label: "Settings",
        icon: Settings,
      },
    ],
  },
];

export const SIDEBAR_STORAGE_KEY = "kataria-sidebar-collapsed";

export function isItemActive(item: NavItem, pathname: string): boolean {
  return item.end
    ? pathname === item.to
    : pathname === item.to || pathname.startsWith(`${item.to}/`);
}
