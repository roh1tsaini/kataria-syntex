/**
 * Auth gate — the "/" route. Loading → skeleton; guest → sign-in;
 * authed → packer-only accounts land straight in packing, everyone else
 * in the dashboard (same routing contract as apps/app's App.tsx).
 */

import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth, isPackerOnlyWorkspace } from "@kataria-syntex/app-core";
import { usePalette } from "@/theme";

export default function Gate() {
  const status = useAuth((s) => s.status);
  const workspace = useAuth((s) => s.workspace);
  const p = usePalette();

  if (status === "loading") {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: p.background }}
      >
        <ActivityIndicator color={p.mutedForeground} />
      </View>
    );
  }
  if (status !== "authed") return <Redirect href="/auth" />;
  if (isPackerOnlyWorkspace(workspace)) return <Redirect href="/packing" />;
  return <Redirect href="/(tabs)" />;
}
