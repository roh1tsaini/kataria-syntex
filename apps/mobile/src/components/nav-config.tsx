/**
 * Navigation config — the phone's slice of the web app's `nav-config.tsx`:
 * one "General" section, no sub-items, no rail.
 */
import {
  Home,
  MonitorSmartphone,
  Settings,
  type LucideIcon,
} from "lucide-react-native";

export type NavPath = "/" | "/devices" | "/settings";

export type NavItem = {
  to: NavPath;
  label: string;
  icon: LucideIcon;
  end?: boolean;
};

export type NavSection = { title: string; items: NavItem[] };

export const SECTIONS: NavSection[] = [
  {
    title: "General",
    items: [
      { to: "/", label: "Home", icon: Home, end: true },
      { to: "/devices", label: "Connected Devices", icon: MonitorSmartphone },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function isItemActive(item: NavItem, pathname: string): boolean {
  return item.end
    ? pathname === item.to
    : pathname === item.to || pathname.startsWith(`${item.to}/`);
}
