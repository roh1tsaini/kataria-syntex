/**
 * OfflineBanner — saving is online-only, and this strip says so plainly.
 * Nothing to tap, nothing queued: the form the user was filling stays open with
 * its input intact, and saving works again as soon as the connection returns.
 */
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CloudOff } from "lucide-react-native";
import { useSync } from "@kataria-syntex/app-core";

import { DURATION, EASE_OUT } from "@/lib/motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useToken } from "@/theme/use-token";
import { Text } from "@/components/ui/text";

export function OfflineBanner() {
  const online = useSync((s) => s.online);
  const reduce = useReducedMotion();
  const insets = useSafeAreaInsets();
  const warning = useToken("--warning");

  const progress = useSharedValue(online ? 0 : 1);

  useEffect(() => {
    progress.value = withTiming(online ? 0 : 1, {
      duration: reduce ? 0 : DURATION.pageEnter + 40,
      easing: EASE_OUT,
    });
  }, [online, progress, reduce]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: -8 * (1 - progress.value) }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[animatedStyle, { paddingTop: insets.top }]}
      className="absolute inset-x-0 top-0 z-20 border-b border-warning-line bg-warning-soft"
      accessibilityElementsHidden={online}
      importantForAccessibility={online ? "no-hide-descendants" : "auto"}
    >
      <View
        className="flex-row items-center justify-center gap-2 py-2 pr-4 pl-16"
        accessibilityRole="alert"
      >
        <CloudOff size={16} color={warning} />
        <Text className="font-medium text-sm text-warning">
          You&rsquo;re offline — go online to save.
        </Text>
      </View>
    </Animated.View>
  );
}
