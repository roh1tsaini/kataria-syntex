import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInUp,
  FadeOut,
  FadeOutDown,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EASE_OUT, useReduceMotion } from "@/lib/motion";
import { dismissToast, useToasts } from "@/lib/toasts";
import { SHADOWS, usePalette } from "@/theme";

/** Sonner bottom-center offset, plus the device inset at render time. */
const EDGE = 16;
/** Sonner stacks its visible toasts with a 14px gap. */
const STACK_GAP = 14;
/** Web enter is a rise + fade; the calm ladder caps entries at 200ms base. */
const ENTER_MS = 200;
/** Exits mirror entries ~20% faster (design.md §5). */
const EXIT_MS = 160;
/** Reduced motion collapses to an opacity cross-fade (design.md §5). */
const FADE_MS = 150;

/** Bottom-center toast stack — the Android counterpart of the web sonner
 * Toaster: card surface, radius 12, overlay shadow, one-line title, newest
 * at the bottom, tap to dismiss. Always mounted so per-toast enter/exit
 * animations play; box-none lets touches pass everywhere but the cards. */
export function ToastOverlay() {
  const toasts = useToasts();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, styles.host]}
    >
      <View
        pointerEvents="box-none"
        style={{
          paddingHorizontal: EDGE,
          paddingBottom: EDGE + insets.bottom,
          gap: STACK_GAP,
        }}
      >
        {toasts.map((toast) => (
          <Animated.View
            key={toast.id}
            entering={
              reduceMotion
                ? FadeIn.duration(FADE_MS)
                : FadeInUp.duration(ENTER_MS).easing(EASE_OUT)
            }
            exiting={
              reduceMotion
                ? FadeOut.duration(FADE_MS)
                : FadeOutDown.duration(EXIT_MS).easing(EASE_OUT)
            }
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={toast.title}
              onPress={() => dismissToast(toast.id)}
              className="rounded-lg p-4"
              style={{
                backgroundColor: palette.card,
                borderColor: palette.border,
                borderWidth: StyleSheet.hairlineWidth,
                boxShadow: SHADOWS.overlay,
              }}
            >
              <Text
                numberOfLines={1}
                accessibilityLiveRegion="polite"
                className="text-[14px] font-semibold"
                style={{ color: palette.cardForeground }}
              >
                {toast.title}
              </Text>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { justifyContent: "flex-end" },
});
