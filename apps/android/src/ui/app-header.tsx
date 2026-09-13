/**
 * AppHeader — the phone translation of apps/app's shell HeaderBar: a
 * translucent 56px bar with the account avatar (opens the navigation drawer),
 * the current screen label centered, and the company chip on the right. Sits
 * above every screen; content scrolls beneath its hairline edge.
 */

import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COMPANY_DETAILS } from "@kataria-syntex/shared";
import { useAuth, useSync } from "@kataria-syntex/app-core";
import { usePalette } from "@/theme";
import { useNavDrawer } from "@/lib/nav-drawer";
import { Feather } from "@/ui/feather";

export function AppHeader({ label }: { label: string }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const openDrawer = useNavDrawer((s) => s.openDrawer);
  const user = useAuth((s) => s.user);
  const company = useAuth((s) => s.company);
  const online = useSync((s) => s.online);
  const initial = user?.name.slice(0, 1).toUpperCase() ?? "K";

  return (
    <View
      style={{
        backgroundColor: p.card,
        borderBottomColor: p.border,
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingTop: insets.top,
      }}
    >
      <View className="h-14 flex-row items-center gap-2 px-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open navigation menu"
          onPress={openDrawer}
          className="h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <View
            className="h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: p.muted }}
          >
            <Text
              className="text-xs font-medium"
              style={{ color: p.foreground }}
            >
              {initial}
            </Text>
          </View>
          <View
            className="absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full border-2"
            style={{
              backgroundColor: online ? p.success : p.warning,
              borderColor: p.card,
            }}
          />
        </Pressable>

        <Text
          className="flex-1 text-center text-[13px] font-medium tracking-tight"
          style={{ color: p.foreground }}
          numberOfLines={1}
        >
          {label}
        </Text>

        <View
          className="max-w-[140px] flex-row items-center gap-1 rounded-sm border px-2 py-1"
          style={{ borderColor: p.border, backgroundColor: p.card }}
        >
          <Feather name="briefcase" size={12} color={p.mutedForeground} />
          <Text
            className="text-xs font-medium"
            style={{ color: p.mutedForeground }}
            numberOfLines={1}
          >
            {company?.name ?? COMPANY_DETAILS.name}
          </Text>
        </View>
      </View>
    </View>
  );
}
