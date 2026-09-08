/**
 * Tab shell — the phone translation of the web sidebar (same nav tree,
 * bottom-tab IA). Packer-only accounts get a single-tab shell landing in
 * packing, matching apps/app's packer mode.
 */

import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth, isPackerOnlyWorkspace } from "@kataria-syntex/app-core";
import { usePalette } from "@/theme";

type TabDef = {
  name: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
};

const PACKER_TABS: TabDef[] = [
  { name: "packing", label: "Packing", icon: "package" },
];

const FULL_TABS: TabDef[] = [
  { name: "index", label: "Dashboard", icon: "home" },
  { name: "challans", label: "Challans", icon: "file-text" },
  { name: "outward", label: "Job work", icon: "send" },
  { name: "packing", label: "Packing", icon: "package" },
  { name: "more", label: "More", icon: "menu" },
];

export default function TabsLayout() {
  const workspace = useAuth((s) => s.workspace);
  const packerOnly = isPackerOnlyWorkspace(workspace);
  const p = usePalette();
  const tabs = packerOnly ? PACKER_TABS : FULL_TABS;

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
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.label,
            tabBarIcon: ({ color, size }) => (
              <Feather name={t.icon} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
