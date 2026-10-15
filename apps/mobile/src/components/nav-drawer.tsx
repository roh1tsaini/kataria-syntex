/**
 * NavDrawer — the phone's full-screen navigation sheet (web app-shell
 * MobileDrawerContent): brand header, the one nav section, and a footer with
 * identity, theme and logout. Slides in on the drawer curve (280ms) and leaves
 * the same way ~30% faster (200ms); it covers the viewport, so there is no
 * scrim.
 */
import { useEffect, useState } from "react";
import { Modal, ScrollView, useWindowDimensions, View } from "react-native";
import { useRouter, usePathname } from "expo-router";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LayoutGrid, List, LogOut, Moon, Sun, X } from "lucide-react-native";
import { COMPANY_DETAILS } from "@kataria-syntex/shared";
import {
  readNavDensity,
  useAuth,
  writeNavDensity,
  type NavDensity,
} from "@kataria-syntex/app-core";

import { cn } from "@/lib/cn";
import { DURATION, EASE_DRAWER } from "@/lib/motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { shadowSoft } from "@/theme/shadows";
import { useTheme } from "@/theme/theme";
import { useToken } from "@/theme/use-token";
import { SECTIONS, isItemActive } from "@/components/nav-config";
import { ButtonCapsule, CircleButton } from "@/components/ui/circle-button";
import { MicroLabel, Text } from "@/components/ui/text";
import { PressableScale } from "@/components/ui/pressable-scale";

export function NavDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(open);
  const translateX = useSharedValue(-width);

  useEffect(() => {
    if (open) {
      setMounted(true);
      translateX.value = reduce
        ? 0
        : withTiming(0, {
            duration: DURATION.drawerEnter,
            easing: EASE_DRAWER,
          });
      return;
    }
    if (!mounted) return;
    translateX.value = withTiming(
      -width,
      { duration: reduce ? 0 : DURATION.drawerExit, easing: EASE_DRAWER },
      (finished) => {
        if (finished) runOnJS(setMounted)(false);
      },
    );
    // width/reduce are read at close time only; re-running would restart the
    // exit animation mid-flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (!mounted) return null;

  return (
    <Modal
      transparent
      visible={mounted}
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View
        style={style}
        className="flex-1 bg-background"
        accessibilityViewIsModal
      >
        <DrawerContent
          contentTop={insets.top}
          contentBottom={insets.bottom}
          onClose={onClose}
        />
      </Animated.View>
    </Modal>
  );
}

function DrawerContent({
  contentTop,
  contentBottom,
  onClose,
}: {
  contentTop: number;
  contentBottom: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const { theme, toggleTheme } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);

  // Read once per account; the key is account-scoped, so a sign-in as someone
  // else starts from that account's own choice.
  const accountId = user?.id ?? null;
  const [density, setDensity] = useState<NavDensity>(() =>
    readNavDensity(accountId),
  );
  useEffect(() => {
    setDensity(readNavDensity(accountId));
  }, [accountId]);

  const changeDensity = (next: NavDensity) => {
    setDensity(next);
    writeNavDensity(accountId, next);
  };

  const muted = useToken("--muted-foreground");
  const card = useToken("--card");
  const foreground = useToken("--foreground");

  const onLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // Local session state is already torn down by the store.
    } finally {
      setLoggingOut(false);
      onClose();
      router.replace("/auth");
    }
  };

  const grid = density === "grid";

  return (
    <View className="flex-1">
      <View className="px-4 pb-3" style={{ paddingTop: 20 + contentTop }}>
        <View className="flex-row items-start justify-between gap-2">
          <View className="min-w-0 pt-1">
            <Text className="font-bold text-2xl tracking-title">
              KS Biz App
            </Text>
            <Text className="mt-1 text-[13px] text-muted-foreground">
              {COMPANY_DETAILS.name}
            </Text>
          </View>
          <CircleButton onPress={onClose} accessibilityLabel="Close navigation">
            <X size={20} color={foreground} />
          </CircleButton>
        </View>
        <View className="mt-3 flex-row justify-end">
          <View className="flex-row items-center gap-1 rounded-full bg-muted-veil p-1">
            {(
              [
                { value: "list" as const, label: "List layout", Icon: List },
                {
                  value: "grid" as const,
                  label: "Grid layout",
                  Icon: LayoutGrid,
                },
              ] satisfies Array<{
                value: NavDensity;
                label: string;
                Icon: typeof List;
              }>
            ).map(({ value, label, Icon }) => (
              <PressableScale
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: density === value }}
                accessibilityLabel={label}
                onPress={() => changeDensity(value)}
                style={density === value ? shadowSoft : undefined}
                className={cn(
                  "size-9 items-center justify-center rounded-full",
                  density === value ? "bg-card" : null,
                )}
              >
                <Icon
                  size={16}
                  color={density === value ? foreground : muted}
                />
              </PressableScale>
            ))}
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-3 py-3">
        {SECTIONS.map((section, index) => (
          <View key={section.title} className={cn(index > 0 && "mt-3")}>
            <View className="px-2 pb-1 pt-3">
              <MicroLabel>{section.title}</MicroLabel>
            </View>
            <View
              className={cn(
                grid ? "flex-row flex-wrap gap-2" : "flex-col gap-0.5",
              )}
            >
              {section.items.map((item) => {
                const active = isItemActive(item, pathname);
                if (grid) {
                  return (
                    <PressableScale
                      key={item.to}
                      onPress={() => {
                        onClose();
                        router.replace(item.to);
                      }}
                      className={cn(
                        "min-h-20 min-w-[45%] flex-1 items-center justify-center gap-2 rounded-lg border bg-card p-3",
                        active
                          ? "border-foreground bg-accent"
                          : "border-border",
                      )}
                    >
                      <item.icon
                        size={20}
                        color={active ? foreground : muted}
                      />
                      <Text
                        className={cn(
                          "text-center text-[13px] leading-[1.3]",
                          active
                            ? "font-medium text-accent-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {item.label}
                      </Text>
                    </PressableScale>
                  );
                }
                return (
                  <PressableScale
                    key={item.to}
                    onPress={() => {
                      onClose();
                      router.replace(item.to);
                    }}
                    className={cn(
                      "min-h-11 flex-row items-center gap-2 rounded-md px-2 py-1.5",
                      active ? "bg-accent" : null,
                    )}
                  >
                    <item.icon size={16} color={active ? foreground : muted} />
                    <Text
                      className={cn(
                        "min-w-0 flex-1 text-[13px]",
                        active
                          ? "font-medium text-accent-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {item.label}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      <View
        className="border-t border-border px-4 pt-3"
        style={{ paddingBottom: 14 + contentBottom }}
      >
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1 flex-row items-center gap-2.5">
            <View className="size-9 items-center justify-center rounded-full bg-muted">
              <Text className="font-semibold text-sm">
                {user?.name.slice(0, 1).toUpperCase() ?? "K"}
              </Text>
            </View>
            <View className="min-w-0 flex-1">
              <Text className="font-medium text-[13px] leading-[1.2]">
                {user?.name}
              </Text>
              <Text className="mt-0.5 text-[11px] text-muted-foreground">
                {user?.email ?? user?.phone ?? COMPANY_DETAILS.name}
              </Text>
            </View>
          </View>
          <ButtonCapsule className="shrink-0">
            <CircleButton
              onPress={toggleTheme}
              accessibilityLabel={
                theme === "dark" ? "Light theme" : "Dark theme"
              }
            >
              {theme === "dark" ? (
                <Sun size={16} color={foreground} />
              ) : (
                <Moon size={16} color={foreground} />
              )}
            </CircleButton>
            <CircleButton
              onPress={() => void onLogout()}
              disabled={loggingOut}
              accessibilityLabel="Log out"
            >
              <LogOut size={16} color={muted} />
            </CircleButton>
          </ButtonCapsule>
        </View>
      </View>
    </View>
  );
}
