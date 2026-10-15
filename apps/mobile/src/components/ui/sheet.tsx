/**
 * Sheet — the phone rendering of the web app's Dialog: a bottom sheet that
 * springs up over a dimmed, blurred scrim, with the same 24px padding, 20px
 * top radius and 16px close circle. Enters on the morph spring (380ms),
 * exits on the same path ~20% faster (300ms) — design.md Section 5.1.
 *
 * Drag-down to dismiss is the native affordance for the close button the web
 * sheet carries; the button is still there, and a blocking sheet (the update
 * gate) turns both off (`dismissible={false}`, `hideClose`).
 */
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Modal, useWindowDimensions, View } from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { X } from "lucide-react-native";

import { cn } from "@/lib/cn";
import { DURATION, EASE_OUT, SPRING, SPRING_EXIT } from "@/lib/motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { CircleButton } from "@/components/ui/circle-button";
import { Text } from "@/components/ui/text";

export function Sheet({
  open,
  onClose,
  hideClose = false,
  dismissible = true,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Blocking sheets render no close affordance. */
  hideClose?: boolean;
  dismissible?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  // Mounted while the exit animation plays; unmounted only once it finishes,
  // so the sheet leaves on the same path it entered (never a hard cut).
  const [mounted, setMounted] = useState(open);
  const [panelHeight, setPanelHeight] = useState(windowHeight * 0.5);
  const translateY = useSharedValue(windowHeight);
  const scrimOpacity = useSharedValue(0);

  useEffect(() => {
    if (open) {
      setMounted(true);
      scrimOpacity.value = withTiming(1, {
        duration: reduce ? 0 : DURATION.color + 50,
        easing: EASE_OUT,
      });
      translateY.value = reduce ? 0 : withSpring(0, SPRING);
      return;
    }
    if (!mounted) return;
    scrimOpacity.value = withTiming(0, {
      duration: reduce ? 0 : DURATION.color,
      easing: EASE_OUT,
    });
    translateY.value = withSpring(
      Math.max(panelHeight, 240),
      SPRING_EXIT,
      (finished) => {
        if (finished) runOnJS(setMounted)(false);
      },
    );
    // panelHeight is only read when closing; re-running on it would restart
    // the exit animation every time the panel measures itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reduce, scrimOpacity, translateY]);

  const dismiss = () => {
    if (dismissible) onClose();
  };

  const pan = Gesture.Pan()
    .enabled(dismissible)
    .onUpdate((event) => {
      translateY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > 96 || event.velocityY > 800) {
        runOnJS(onClose)();
        return;
      }
      translateY.value = withSpring(0, SPRING);
    });

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: scrimOpacity.value,
  }));

  if (!mounted) return null;

  return (
    <Modal
      transparent
      visible={mounted}
      statusBarTranslucent
      animationType="none"
      onRequestClose={dismiss}
    >
      {/* A Modal is a separate native view hierarchy on Android, so the drag
          gesture needs its own handler root inside it. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 justify-end">
          <Animated.View
            style={[scrimStyle, { backgroundColor: "rgba(0, 0, 0, 0.4)" }]}
            className="absolute inset-0"
          >
            <BlurView
              intensity={12}
              tint="dark"
              experimentalBlurMethod="dimezisBlurView"
              className="flex-1"
            />
          </Animated.View>
          <GestureDetector gesture={pan}>
            <Animated.View
              style={[panelStyle, { paddingBottom: 24 + insets.bottom }]}
              onLayout={(event) =>
                setPanelHeight(event.nativeEvent.layout.height)
              }
              accessibilityViewIsModal
              className={cn(
                "rounded-t-2xl border-t border-border bg-card px-6 pt-6",
                className,
              )}
            >
              {children}
              {!hideClose && (
                <CircleButton
                  className="absolute right-4 top-4 z-10 bg-card"
                  onPress={dismiss}
                  accessibilityLabel="Close dialog"
                >
                  <X size={16} />
                </CircleButton>
              )}
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

export function SheetHeader({
  className,
  ...props
}: React.ComponentProps<typeof View>) {
  return <View className={cn("flex-col gap-1.5", className)} {...props} />;
}

/** Section-head type scale (web DialogTitle: 17px semibold). */
export function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof Text>) {
  return (
    <Text
      className={cn(
        "font-semibold text-[17px] leading-[1.3] tracking-[-0.01em]",
        className,
      )}
      accessibilityRole="header"
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof Text>) {
  return (
    <Text
      className={cn(
        "text-[13px] leading-[1.6] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
