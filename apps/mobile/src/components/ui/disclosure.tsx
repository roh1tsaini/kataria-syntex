/**
 * Disclosure — the shared expanding panel (web `ui/disclosure.tsx`).
 *
 * Enter settles at 380ms, exit mirrors it at 300ms; the content is measured so
 * the panel animates its real height instead of guessing.
 */
import { useEffect, useState, type ReactNode } from "react";
import { View, type ViewProps } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { ChevronDown } from "lucide-react-native";

import { cn } from "@/lib/cn";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";

export function MorphPanel({
  open,
  children,
  className,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [measured, setMeasured] = useState(0);
  const progress = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, {
      duration: reduce ? 0 : open ? DURATION.morphEnter : DURATION.morphExit,
      easing: EASE_OUT,
    });
  }, [open, progress, reduce]);

  const animatedStyle = useAnimatedStyle(() => ({
    // `measured` is 0 until the content reports its size: a closed panel must
    // not flash at its natural height in that window, so height tracks the
    // progress from 0 rather than falling back to auto.
    height: measured * progress.value,
    opacity: progress.value,
  }));

  return (
    <Animated.View
      style={animatedStyle}
      className={cn("overflow-hidden", className)}
      pointerEvents={open ? "auto" : "none"}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? "auto" : "no-hide-descendants"}
    >
      <View onLayout={(event) => setMeasured(event.nativeEvent.layout.height)}>
        {children}
      </View>
    </Animated.View>
  );
}

export function MorphChevron({
  open,
  size = 14,
  className,
}: {
  open: boolean;
  size?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const progress = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, {
      duration: reduce ? 0 : open ? DURATION.morphEnter : DURATION.morphExit,
      easing: EASE_OUT,
    });
  }, [open, progress, reduce]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle} className={className}>
      <ChevronDown size={size} />
    </Animated.View>
  );
}

/** Row that toggles a MorphPanel; used by settings and device groups. */
export function DisclosureRow({ className, ...props }: ViewProps) {
  return <View className={cn("flex-col", className)} {...props} />;
}
