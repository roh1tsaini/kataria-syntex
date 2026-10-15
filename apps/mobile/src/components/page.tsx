/**
 * Page — the shell's content scroller, and its route transition.
 *
 * The web shell gives every route the same frame: `px-4 pt-16 pb-28` inside a
 * scroller, entered with a 160ms fade + 4px rise (exit 130ms). pt-16 is the
 * band the floating menu circle occupies; pb-28 clears the tab capsule.
 */
import type { ReactNode } from "react";
import { useEffect } from "react";
import { ScrollView, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { cn } from "@/lib/cn";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";

export function Page({
  children,
  scroll = true,
  contentClassName,
  className,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentClassName?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const progress = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: reduce ? 0 : DURATION.pageEnter,
      easing: EASE_OUT,
    });
  }, [progress, reduce]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: 4 * (1 - progress.value) }],
  }));

  const content = cn("px-4 pt-16 pb-28", contentClassName);

  if (!scroll) {
    return (
      <Animated.View style={style} className={cn("flex-1", className)}>
        <View className={cn("flex-1", content)}>{children}</View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={style} className={cn("flex-1", className)}>
      <ScrollView
        className="flex-1"
        contentContainerClassName={content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </Animated.View>
  );
}
