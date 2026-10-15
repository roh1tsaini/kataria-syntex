/**
 * Boot splash — the app mark while the session resolves (web ProtectedRoute's
 * Splash): 56px primary tile, "K", fade + 0.96→1 scale over 220ms.
 */
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { COMPANY_DETAILS } from "@kataria-syntex/shared";

import { EASE_OUT } from "@/lib/motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { Text } from "@/components/ui/text";

export function Splash() {
  const reduce = useReducedMotion();
  const progress = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: reduce ? 0 : 220,
      easing: EASE_OUT,
    });
  }, [progress, reduce]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.96 + 0.04 * progress.value }],
  }));

  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Animated.View
        style={style}
        className="size-14 items-center justify-center rounded-xl bg-primary"
        accessibilityRole="image"
        accessibilityLabel={`Loading ${COMPANY_DETAILS.name} Biz App`}
      >
        <Text className="font-bold text-2xl leading-none text-primary-foreground">
          K
        </Text>
      </Animated.View>
    </View>
  );
}
