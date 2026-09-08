/**
 * Job-work challans tab — the phone port of apps/app's /outward register
 * (type="outward"): same list as sales, party label = job worker, no rates.
 */

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View } from "react-native";
import { Screen } from "@/ui/kit";
import { ChallanList, OUTWARD_KIND } from "@/ui/challan-list";

export default function OutwardTab() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1" style={{ paddingTop: insets.top }}>
      <Screen title={OUTWARD_KIND.title} subtitle={OUTWARD_KIND.desc}>
        <ChallanList kind={OUTWARD_KIND} />
      </Screen>
    </View>
  );
}
