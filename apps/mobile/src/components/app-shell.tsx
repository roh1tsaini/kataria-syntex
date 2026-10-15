/**
 * AppShell — the phone shell (web `app-shell.tsx`, ≤sm branch): route content,
 * the offline strip in flow above it, the floating panel-left circle, the
 * bottom tab capsule, the full-screen drawer, and the toast host.
 *
 * Desktop-only pieces of the web shell (sidebar, header row, window chrome)
 * have no phone rendering and are not ported.
 */
import type { ReactNode } from "react";
import { useState } from "react";
import { View } from "react-native";
import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PanelLeft } from "lucide-react-native";
import { useNetworkState } from "@kataria-syntex/app-core";

import { shadowOverlay } from "@/theme/shadows";
import { useToken } from "@/theme/use-token";
import { CircleButton } from "@/components/ui/circle-button";
import { OfflineBanner } from "@/components/offline-banner";
import { NavDrawer } from "@/components/nav-drawer";
import { TabBar } from "@/components/ui/tab-bar";
import { ToastHost } from "@/components/ui/toast-host";

export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const foreground = useToken("--foreground");

  // Cheap reachability probe, mounted once per session (app-core owns state).
  useNetworkState();

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <OfflineBanner />

      <View className="flex-1" key={pathname}>
        {children}
      </View>

      {/* Floating panel-left circle (design.md Section 2.7.2) — fixed top-left,
          over the content, in the card material. Respects safe area insets. */}
      <View className="absolute left-4 z-40" style={{ top: insets.top + 16 }}>
        <CircleButton
          className="border-0 bg-card"
          style={shadowOverlay}
          onPress={() => setDrawerOpen(true)}
          accessibilityLabel="Open navigation menu"
        >
          <PanelLeft size={20} color={foreground} />
        </CircleButton>
      </View>

      <TabBar onMore={() => setDrawerOpen(true)} hidden={drawerOpen} />
      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <ToastHost />
    </View>
  );
}
