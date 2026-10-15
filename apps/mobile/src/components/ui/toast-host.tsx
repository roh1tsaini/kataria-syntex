/**
 * Toast host — the native surface for app-core's toast sink (sonner on web).
 *
 * Same contract as the web toaster (design.md Section 3): top-centre below the
 * status bar, title + optional description, a tinted status glyph, at most three
 * visible, 4s dwell for success and 8s for error, and a swipe up or right to
 * dismiss. A toast leaves on the morph spring ~20% faster than it arrived.
 */
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeInDown,
  FadeOutUp,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CircleCheck, CircleX, X } from "lucide-react-native";
import { configureToasts } from "@kataria-syntex/app-core";

import { cn } from "@/lib/cn";
import { SPRING } from "@/lib/motion";
import { shadowOverlay } from "@/theme/shadows";
import { useToken } from "@/theme/use-token";
import { CircleButton } from "@/components/ui/circle-button";
import { Text } from "@/components/ui/text";

type ToastKind = "success" | "error";

type Toast = {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
};

/** Dwell per kind, matching the web sink in apps/app/src/main/app/main.tsx. */
const DWELL_MS: Record<ToastKind, number> = {
  success: 4000,
  error: 8000,
};

const MAX_VISIBLE = 3;

export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const dismiss = (id: number) => {
      const timer = timers.current.get(id);
      if (timer) clearTimeout(timer);
      timers.current.delete(id);
      setToasts((current) => current.filter((toast) => toast.id !== id));
    };

    const push = (kind: ToastKind, title: string, description?: string) => {
      const id = nextId.current++;
      // Newest on top, oldest beyond the third pushed out — same as sonner's
      // top-centre stack.
      setToasts((current) =>
        [{ id, kind, title, description }, ...current].slice(0, MAX_VISIBLE),
      );
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DWELL_MS[kind]),
      );
    };

    configureToasts({
      success: (title, description) => push("success", title, description),
      error: (title, description) => push("error", title, description),
    });

    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 z-50 items-center gap-3.5 px-4"
      style={{ top: 16 + insets.top }}
    >
      {toasts.map((toast) => (
        <ToastCard
          key={toast.id}
          toast={toast}
          onDismiss={() =>
            setToasts((current) => current.filter((t) => t.id !== toast.id))
          }
        />
      ))}
    </View>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const swipe = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = Math.max(0, event.translationX);
      translateY.value = Math.min(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationX > 80 || event.translationY < -32) {
        runOnJS(onDismiss)();
        return;
      }
      translateX.value = withSpring(0, SPRING);
      translateY.value = withSpring(0, SPRING);
    });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const success = toast.kind === "success";
  // Icons take colour from a prop, never from a class: NativeWind maps
  // className to style only for the components it interops with.
  const glyph = useToken(
    toast.kind === "success" ? "--success" : "--destructive",
  );
  const muted = useToken("--muted-foreground");

  return (
    <GestureDetector gesture={swipe}>
      <Animated.View
        entering={FadeInDown.duration(380)}
        exiting={FadeOutUp.duration(300)}
        style={[style, shadowOverlay]}
        accessibilityLiveRegion="polite"
        className={cn(
          "w-full max-w-sm flex-row items-start gap-2.5 rounded-lg border border-border bg-card p-3.5",
        )}
      >
        {success ? (
          <CircleCheck size={16} color={glyph} style={{ marginTop: 2 }} />
        ) : (
          <CircleX size={16} color={glyph} style={{ marginTop: 2 }} />
        )}
        <View className="min-w-0 flex-1">
          <Text className="font-semibold text-sm leading-[1.3]">
            {toast.title}
          </Text>
          {toast.description ? (
            <Text className="mt-0.5 text-[13px] leading-[1.4] text-muted-foreground">
              {toast.description}
            </Text>
          ) : null}
        </View>
        <CircleButton
          size="md"
          className="size-7 border-0"
          onPress={onDismiss}
          accessibilityLabel="Dismiss notification"
        >
          <X size={14} color={muted} />
        </CircleButton>
      </Animated.View>
    </GestureDetector>
  );
}
