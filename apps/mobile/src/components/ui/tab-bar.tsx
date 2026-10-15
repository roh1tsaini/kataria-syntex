/**
 * TabBar — the bottom capsule (design.md Section 2.7.2): the two primary
 * shortcuts plus More, which opens the full-screen drawer.
 *
 * The selection pill slides between items on the morph spring and the incoming
 * icon answers with a pop (0.82 → 1.14 → 1, 260ms) — the web app's tab-pop
 * keyframes. Hidden while a drawer covers it or a field has the keyboard.
 */
import { useEffect, useState } from "react";
import { Keyboard, View } from "react-native";
import { useRouter, usePathname } from "expo-router";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { Ellipsis } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { cn } from "@/lib/cn";
import { DURATION, EASE_OUT, SPRING } from "@/lib/motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { shadowOverlay } from "@/theme/shadows";
import { useTheme } from "@/theme/theme";
import { useToken } from "@/theme/use-token";
import { SECTIONS, isItemActive, type NavItem } from "@/components/nav-config";
import { PressableScale } from "@/components/ui/pressable-scale";

/** One item: 44px circle with a 4px gap — the pill steps by this much. */
const ITEM_SIZE = 44;
const ITEM_GAP = 4;

/** Home + Connected Devices, deduplicated, in nav order (web useTabBarItems). */
const TAB_PATHS = ["/", "/devices"] as const;
const TAB_ITEMS: NavItem[] = TAB_PATHS.map((to) =>
  SECTIONS.flatMap((section) => section.items).find((i) => i.to === to),
).filter((item): item is NavItem => item !== undefined);

export function TabBar({
  onMore,
  hidden = false,
}: {
  onMore: () => void;
  hidden?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const { theme } = useTheme();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const activeIndex = TAB_ITEMS.findIndex((item) =>
    isItemActive(item, pathname),
  );
  const moreActive = activeIndex < 0;

  const pill = useSharedValue(
    activeIndex >= 0 ? activeIndex : TAB_ITEMS.length,
  );

  useEffect(() => {
    const target = activeIndex >= 0 ? activeIndex : TAB_ITEMS.length;
    pill.value = reduce ? target : withSpring(target, SPRING);
  }, [activeIndex, pill, reduce]);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardOpen(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardOpen(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pill.value * (ITEM_SIZE + ITEM_GAP) }],
  }));

  const inactive = useToken("--muted-foreground");
  const active = useToken("--primary-foreground");

  const hiddenNow = hidden || keyboardOpen;

  return (
    <View
      pointerEvents={hiddenNow ? "none" : "box-none"}
      className={cn(
        "absolute inset-x-0 bottom-0 z-30 items-center",
        hiddenNow && "opacity-0",
      )}
      style={{ paddingBottom: 12 + insets.bottom }}
      accessibilityElementsHidden={hiddenNow}
    >
      <View
        style={shadowOverlay}
        className="relative flex-row items-center gap-1 rounded-full border border-border p-1"
      >
        {/* Capsule material: translucent card over content (globals.css
            .capsule-surface), with a solid fill as the fallback. */}
        <BlurView
          intensity={24}
          tint={theme}
          experimentalBlurMethod="dimezisBlurView"
          className="absolute inset-0 rounded-full bg-capsule-surface"
        />
        <Animated.View
          pointerEvents="none"
          style={[pillStyle, { width: ITEM_SIZE, height: ITEM_SIZE }]}
          className="absolute left-1 top-1 rounded-full bg-primary"
        />
        {TAB_ITEMS.map((item, index) => (
          <TabBarButton
            key={item.to}
            label={item.label}
            active={activeIndex === index}
            onPress={() => router.replace(item.to)}
            icon={
              <item.icon
                size={20}
                color={activeIndex === index ? active : inactive}
              />
            }
          />
        ))}
        <TabBarButton
          label="More navigation"
          active={moreActive}
          onPress={onMore}
          icon={<Ellipsis size={20} color={moreActive ? active : inactive} />}
        />
      </View>
    </View>
  );
}

function TabBarButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onPress: () => void;
}) {
  const reduce = useReducedMotion();
  const pop = useSharedValue(1);

  useEffect(() => {
    if (!active || reduce) {
      pop.value = 1;
      return;
    }
    pop.value = withSequence(
      withTiming(0.82, { duration: 0, easing: EASE_OUT }),
      withTiming(1.14, { duration: 140, easing: EASE_OUT }),
      withTiming(1, { duration: 120, easing: EASE_OUT }),
    );
  }, [active, pop, reduce]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      className="items-center justify-center rounded-full"
      style={{ width: ITEM_SIZE, height: ITEM_SIZE }}
    >
      <Animated.View style={style}>{icon}</Animated.View>
    </PressableScale>
  );
}
