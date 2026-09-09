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
  Platform,
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
import { SafeAreaView } from "react-native-safe-area-context";
import { usePalette } from "@/theme";
import { MORPH, MORPH_EXIT, useReduceMotion } from "@/lib/motion";

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
    progress.value = withSpring(
      0,
      reduce ? { mass: 1, stiffness: 4000, damping: 200 } : MORPH_EXIT,
      (finished) => {
        if (finished) runOnJS(setMounted)(false);
      },
    );
  }, [open, reduce, progress]);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onOpenChange(false);
      return true;
    });
    return () => sub.remove();
  }, [open, onOpenChange]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 64 }],
    opacity: progress.value,
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
      <KeyboardAvoidingView
        className="flex-1 justify-end"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable
          accessibilityLabel="Close"
          onPress={() => onOpenChange(false)}
          style={[StyleSheet.absoluteFill]}
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              backdropStyle,
              { backgroundColor: "#00000066" },
            ]}
          />
        </Pressable>
        <SafeAreaView
          edges={["bottom", "left", "right"]}
          style={{ maxHeight: maxHeight * winH }}
        >
          <Animated.View
            style={[
              panelStyle,
              {
                backgroundColor: p.background,
                borderTopColor: p.border,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                overflow: "hidden",
              },
            ]}
          >
            {title ? (
              <View className="flex-row items-center justify-between px-4 pt-4">
                <Text
                  className="text-[17px] font-semibold"
                  style={{ color: p.foreground }}
                >
                  {title}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onOpenChange(false)}
                  className="min-h-[44px] justify-center px-3"
                >
                  <Text className="text-[15px]" style={{ color: p.primary }}>
                    Close
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {children}
          </Animated.View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
