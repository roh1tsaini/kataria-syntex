/**
 * Auth gate — the "/" route. Loading → skeleton; guest → sign-in;
 * authed → packer-only accounts land straight in packing, everyone else
 * in the dashboard (same routing contract as apps/app's App.tsx).
 */

import { View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth, isPackerOnlyWorkspace } from "@kataria-syntex/app-core";
import { usePalette } from "@/theme";
import { Skeleton } from "@/ui/kit";

export default function Gate() {
  const status = useAuth((s) => s.status);
  const workspace = useAuth((s) => s.workspace);
  const p = usePalette();

  if (status === "loading") {
    return (
      <View
        className="flex-1 items-center justify-center gap-3 p-6"
        style={{ backgroundColor: p.background }}
      >
        <Skeleton className="h-12 w-12 rounded-2xl" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-28" />
      </View>
    );
  }
  if (status !== "authed") return <Redirect href="/auth" />;
  if (isPackerOnlyWorkspace(workspace))
    return <Redirect href="/(tabs)/packing" />;
  return <Redirect href="/(tabs)" />;
}
