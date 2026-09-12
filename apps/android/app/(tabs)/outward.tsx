/**
 * Job-work challans tab — the phone port of apps/app's /outward register
 * (type="outward"): same list as sales, party label = job worker, no rates.
 */

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@kataria-syntex/app-core";
import { Screen } from "@/ui/kit";
import { ChallanList } from "@/ui/challan-list";
import { OUTWARD_KIND } from "@/lib/challan-kinds";

export default function OutwardTab() {
  const insets = useSafeAreaInsets();
  const status = useAuth((s) => s.status);
  if (status === "loading") return null;
  if (status === "guest") return <Redirect href="/auth" />;
  return (
    <View className="flex-1" style={{ paddingTop: insets.top }}>
      <Screen
        title={OUTWARD_KIND.title}
        subtitle={OUTWARD_KIND.desc}
        safeTop={false}
      >
        <ChallanList kind={OUTWARD_KIND} />
      </Screen>
    </View>
  );
}
