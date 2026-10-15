/**
 * ProgressBar — track + fill + a percent/size readout, and an honest shimmer
 * when the source cannot report a total size.
 */
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { formatUpdateProgress } from "@kataria-syntex/shared";

import { cn } from "@/lib/cn";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { Text } from "@/components/ui/text";
import { useReducedMotion } from "@/lib/use-reduced-motion";

export function ProgressBar({
  percent,
  totalBytes,
  className,
}: {
  percent: number;
  totalBytes: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const known = totalBytes > 0;
  const clamped = Math.max(0, Math.min(100, percent));

  // The fill grows between samples instead of jumping: the update store
  // throttles what it pushes, the bar smooths the gap.
  const progress = useSharedValue(clamped);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(clamped, {
      duration: reduce ? 0 : DURATION.color,
      easing: EASE_OUT,
    });
  }, [clamped, progress, reduce]);

  useEffect(() => {
    if (known || reduce) return;
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
  }, [known, reduce, shimmer]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
  }));

  return (
    <View className={cn("flex-col gap-1.5", className)}>
      <View
        className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
        accessibilityRole="progressbar"
      >
        {known ? (
          <Animated.View
            className="h-full rounded-full bg-primary"
            style={fillStyle}
          />
        ) : (
          <ShimmerBar progress={shimmer} />
        )}
      </View>
      <Text className="text-right text-xs text-muted-foreground">
        {known
          ? formatUpdateProgress({ percent: clamped, totalBytes })
          : "Downloading…"}
      </Text>
    </View>
  );
}

/** Unknown size: a sweep that never claims to know where the end is. */
function ShimmerBar({ progress }: { progress: { value: number } }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: `${-40 + progress.value * 140}%` }],
  }));
  return (
    <Animated.View
      className="absolute inset-y-0 w-2/5 rounded-full bg-primary"
      style={style}
    />
  );
}
