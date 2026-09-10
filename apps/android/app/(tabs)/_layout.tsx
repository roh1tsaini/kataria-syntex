/**
 * Tab shell — the phone translation of the web sidebar (same nav tree,
 * bottom-tab IA). Tabs are permission-filtered exactly like the web bottom
 * bar (nav-config BOTTOM_ITEMS): a member never sees a destination they
 * can't open. Packer-only accounts get a single-tab shell landing in
 * packing, matching apps/app's packer mode.
 *
 * Hidden tabs are declared with `href: null` rather than omitted — every
 * file in this directory is a route, so an undeclared screen would still
 * register and appear in the bar.
 */

import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  useAuth,
  usePermission,
  isPackerOnlyWorkspace,
  type Permission,
} from "@kataria-syntex/app-core";
import { usePalette } from "@/theme";

type TabDef = {
  name: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  /** Any-of semantics, mirroring the web nav config. Empty = always shown. */
  permissions: Permission[];
};

const TABS: TabDef[] = [
  { name: "index", label: "Dashboard", icon: "home", permissions: [] },
  {
    name: "challans",
    label: "Challans",
    icon: "file-text",
    permissions: ["create_challan", "edit_challan", "delete_challan"],
  },
  {
    name: "outward",
    label: "Job work",
    icon: "send",
    permissions: ["create_challan", "edit_challan", "delete_challan"],
  },
  {
    name: "packing",
    label: "Packing",
    icon: "package",
    permissions: ["create_packing", "edit_packing"],
  },
  { name: "more", label: "More", icon: "menu", permissions: [] },
];

export default function TabsLayout() {
  const workspace = useAuth((s) => s.workspace);
  const can = usePermission();
  const packerOnly = isPackerOnlyWorkspace(workspace);
  const p = usePalette();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: p.primary,
        tabBarInactiveTintColor: p.mutedForeground,
        tabBarStyle: {
          backgroundColor: p.card,
          borderTopColor: p.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      {TABS.map((t) => {
        const visible = packerOnly
          ? t.name === "packing"
          : t.permissions.length === 0 ||
            t.permissions.some((perm) => can(perm));
        return (
          <Tabs.Screen
            key={t.name}
            name={t.name}
            options={{
              href: visible ? undefined : null,
              title: t.label,
              tabBarIcon: ({ color, size }) => (
                <Feather name={t.icon} size={size} color={color} />
              ),
            }}
          />
        );
      })}
    </Tabs>
  );
}
