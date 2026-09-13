/**
 * MorphSheet — the shared animated sheet for every modal surface in the
 * app (design.md §5.6 morph grammar). A dimming backdrop fades while the
 * panel springs up from the bottom edge; exit mirrors the entry ~20%
 * faster. Replaces bare `Modal animationType="slide"`.
 *
 * Usage mirrors RN Modal: `<MorphSheet open={open} onOpenChange={setOpen}>`
 * with an optional `title` header row carrying the Close action.
 */

import { useEffect, useState, type ReactNode } from "react";
import {
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { usePalette, SHADOWS, SCRIM } from "@/theme";
import { MORPH, MORPH_EXIT, useReduceMotion } from "@/lib/motion";
import { Feather } from "@/ui/feather";

export function MorphSheet({
  open,
  onOpenChange,
  title,
  children,
  maxHeight = 0.9,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional header row with a Close action (matches kit grammar). */
  title?: string;
  children: ReactNode;
  /** Fraction of window height the sheet may occupy (0–1). */
  maxHeight?: number;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const reduce = useReduceMotion();
  // Mounted while an enter/exit animation is on screen; RN Modal provides
  // the portal + focus + back handling around it.
  const [mounted, setMounted] = useState(open);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (open) {
      setMounted(true);
      progress.value = reduce
        ? withTiming(1, { duration: 1 })
        : withSpring(1, MORPH);
      return;
    }
    if (reduce) {
      progress.value = withTiming(0, { duration: 1 }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
      return;
    }
    progress.value = withSpring(0, MORPH_EXIT, (finished) => {
      if (finished) runOnJS(setMounted)(false);
    });
  }, [open, reduce, progress]);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onOpenChange(false);
      return true;
    });
    return () => sub.remove();
  }, [open, onOpenChange]);

  // The web sheet travels the full path (y: 100% → 0), not a peeking offset.
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * winH }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  if (!mounted) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={() => onOpenChange(false)}
      statusBarTranslucent
    >
      {/* Every dismissal — scrim, back button, Close — funnels through
          onOpenChange so callers can run guards (dirty checks) first. */}
      <KeyboardAvoidingView className="flex-1 justify-end" behavior={undefined}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => onOpenChange(false)}
          style={[StyleSheet.absoluteFill]}
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              backdropStyle,
              { backgroundColor: SCRIM },
            ]}
          />
        </Pressable>
        <SafeAreaView
          edges={["left", "right"]}
          style={{ maxHeight: maxHeight * winH }}
        >
          <Animated.View
            style={[
              panelStyle,
              {
                backgroundColor: p.card,
                borderTopColor: p.border,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                boxShadow: SHADOWS.overlay,
                // Web mobile sheets pad 24px over the safe-area inset.
                paddingBottom: 24 + insets.bottom,
                overflow: "hidden",
              },
            ]}
          >
            {title ? (
              <View className="px-4 pt-4 pr-14">
                <Text
                  className="text-[17px] font-semibold"
                  style={{ color: p.foreground }}
                >
                  {title}
                </Text>
              </View>
            ) : null}
            {/* Web dialog close affordance: a 44px X, no text label. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={() => onOpenChange(false)}
              className="absolute right-2 top-2 h-11 w-11 items-center justify-center"
              style={{ opacity: 0.7 }}
            >
              <Feather name="x" size={16} color={p.foreground} />
            </Pressable>
            {children}
          </Animated.View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
