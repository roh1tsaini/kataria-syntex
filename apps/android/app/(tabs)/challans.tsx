/**
 * Sales challans tab — the phone port of apps/app's /challans register
 * (type="sales"): search, FY filter, offline-pending flags, pagination,
 * new-challan action gated by create_challan.
 */

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@kataria-syntex/app-core";
import { Screen } from "@/ui/kit";
import { ChallanList } from "@/ui/challan-list";
import { SALES_KIND } from "@/lib/challan-kinds";

export default function ChallansTab() {
  const insets = useSafeAreaInsets();
  const status = useAuth((s) => s.status);
  if (status === "loading") return null;
  if (status === "guest") return <Redirect href="/auth" />;
  return (
    <View className="flex-1" style={{ paddingTop: insets.top }}>
      <Screen title={SALES_KIND.title} subtitle={SALES_KIND.desc}>
        <ChallanList kind={SALES_KIND} />
      </Screen>
    </View>
  );
}
