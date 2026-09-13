/**
 * Tab shell — route container only. Navigation is the full-screen left
 * NavDrawer (src/ui/nav-drawer.tsx), identical to apps/app; there is no
 * bottom tab bar on either app. The Tabs navigator stays so the four primary
 * destinations live in one stack level without pushing onto the root stack.
 */

import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={() => null}
      screenOptions={{ headerShown: false, tabBarStyle: { display: "none" } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="challans" />
      <Tabs.Screen name="outward" />
      <Tabs.Screen name="packing" />
    </Tabs>
  );
}
