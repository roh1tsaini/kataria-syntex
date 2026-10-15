/**
 * Skeleton — clean, lightweight placeholder (the web app has no spinners;
 * loading is a shimmer that mirrors the content it stands in for).
 */
import { useEffect } from "react";
import { View, type ViewProps } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { cn } from "@/lib/cn";
import { useReducedMotion } from "@/lib/use-reduced-motion";

export function Skeleton({
  className,
  ...props
}: ViewProps & { className?: string }) {
  const reduce = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduce) {
      opacity.value = 0.7;
      return;
    }
    opacity.value = withRepeat(
      withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity, reduce]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      className={cn("rounded-lg bg-muted-soft", className)}
      style={animatedStyle}
      accessible={false}
      {...props}
    />
  );
}

/** Non-animated block, for tests and for skeletons inside skeletons. */
export function SkeletonBlock({
  className,
  ...props
}: ViewProps & { className?: string }) {
  return (
    <View className={cn("rounded-lg bg-muted-soft", className)} {...props} />
  );
}
