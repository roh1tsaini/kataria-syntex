/**
 * Press feedback (globals.css `.btn-motion`): transform answers in 100ms and
 * settles back in 150ms, both on EASE_OUT. Reduced motion drops the scale.
 *
 * Every tappable surface in this app goes through here, so press behaviour is
 * one implementation instead of a per-screen style.
 */
import type { ReactNode } from "react";
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { DURATION, EASE_OUT } from "@/lib/motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, "style"> & {
  className?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export function PressableScale({
  className,
  style,
  disabled,
  onPressIn,
  onPressOut,
  children,
  ...props
}: PressableScaleProps) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      className={className}
      style={[style, animatedStyle]}
      onPressIn={(event) => {
        if (!reduce && !disabled) {
          scale.value = withTiming(0.97, {
            duration: DURATION.press,
            easing: EASE_OUT,
          });
        }
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withTiming(1, {
          duration: DURATION.color,
          easing: EASE_OUT,
        });
        onPressOut?.(event);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
