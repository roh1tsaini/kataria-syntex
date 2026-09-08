/**
 * Sales challans tab — the phone port of apps/app's /challans register
 * (type="sales"): search, FY filter, offline-pending flags, pagination,
 * new-challan action gated by create_challan.
 */

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View } from "react-native";
import { Screen } from "@/ui/kit";
import { ChallanList, SALES_KIND } from "@/ui/challan-list";

export default function ChallansTab() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1" style={{ paddingTop: insets.top }}>
      <Screen title={SALES_KIND.title} subtitle={SALES_KIND.desc}>
        <ChallanList kind={SALES_KIND} />
      </Screen>
    </View>
  );
}
