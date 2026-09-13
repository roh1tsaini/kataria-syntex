/**
 * NavDrawer — the Android phone navigation, identical in structure to
 * apps/app's mobile drawer: a full-screen panel that slides in from the left
 * (Apple EASE_DRAWER, 280ms in / 200ms out), opened from the header avatar.
 * It carries the brand header, the FY/sync strip, the permission-gated nav
 * tree, and the footer identity with theme + log out and the primary action.
 *
 * Mounted once in the root layout so it overlays every route. There is no
 * bottom tab bar — this drawer is the only mobile navigation, on both apps.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePathname, useRouter, useGlobalSearchParams } from "expo-router";
import { COMPANY_DETAILS } from "@kataria-syntex/shared";
import {
  useAuth,
  usePermission,
  useSync,
  isPackerOnlyWorkspace,
  friendlyError,
  toastError,
  type Permission,
} from "@kataria-syntex/app-core";
import { usePalette, withAlpha } from "@/theme";
import { setScheme } from "@/lib/theme";
import {
  DRAWER_ENTER_MS,
  DRAWER_EXIT_MS,
  EASE_DRAWER,
  useReduceMotion,
} from "@/lib/motion";
import { useNavDrawer } from "@/lib/nav-drawer";
import { Badge, Button } from "@/ui/kit";
import { Feather } from "@/ui/feather";
import { SyncSheet } from "@/ui/sync";
import {
  PACKER_SECTIONS,
  SECTIONS,
  isItemActive,
  isSubActive,
  type NavParams,
  type NavSection,
} from "@/ui/nav-sections";

function RoleBadge({ isPrimaryAdmin }: { isPrimaryAdmin?: boolean }) {
  if (isPrimaryAdmin === undefined) return null;
  return (
    <Badge
      label={isPrimaryAdmin ? "Primary Admin" : "Member"}
      tone={isPrimaryAdmin ? "accent" : "warning"}
    />
  );
}

function CircleButton({
  onPress,
  label,
  disabled,
  children,
}: {
  onPress: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      className="h-11 w-11 shrink-0 items-center justify-center rounded-full border"
      style={({ pressed }) => ({
        borderColor: p.border,
        backgroundColor: p.card,
        opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

export function NavDrawer() {
  const open = useNavDrawer((s) => s.open);
  const closeDrawer = useNavDrawer((s) => s.closeDrawer);
  const reduce = useReduceMotion();
  const { width } = useWindowDimensions();
  const [mounted, setMounted] = useState(open);
  const [syncOpen, setSyncOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const progress = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    if (open) {
      setMounted(true);
      progress.value = withTiming(1, {
        duration: reduce ? 0 : DRAWER_ENTER_MS,
        easing: EASE_DRAWER,
      });
      return;
    }
    progress.value = withTiming(
      0,
      { duration: reduce ? 0 : DRAWER_EXIT_MS, easing: EASE_DRAWER },
      (finished) => {
        if (finished) runOnJS(setMounted)(false);
      },
    );
  }, [open, reduce, progress]);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeDrawer();
      return true;
    });
    return () => sub.remove();
  }, [open, closeDrawer]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (progress.value - 1) * width }],
    opacity: 0.4 + progress.value * 0.6,
  }));

  const toggleGroup = useCallback((to: string) => {
    setExpanded((prev) => ({ ...prev, [to]: !prev[to] }));
  }, []);

  if (!mounted) {
    return <SyncSheet open={syncOpen} onOpenChange={setSyncOpen} />;
  }

  return (
    <>
      <Modal
        visible
        transparent
        animationType="none"
        onRequestClose={closeDrawer}
        statusBarTranslucent
      >
        <Animated.View
          style={[StyleSheet.absoluteFill, panelStyle]}
          accessibilityViewIsModal
        >
          <DrawerContent
            expanded={expanded}
            onToggleGroup={toggleGroup}
            onClose={closeDrawer}
            onOpenSync={() => {
              closeDrawer();
              setSyncOpen(true);
            }}
          />
        </Animated.View>
      </Modal>
      <SyncSheet open={syncOpen} onOpenChange={setSyncOpen} />
    </>
  );
}

function DrawerContent({
  expanded,
  onToggleGroup,
  onClose,
  onOpenSync,
}: {
  expanded: Record<string, boolean>;
  onToggleGroup: (to: string) => void;
  onClose: () => void;
  onOpenSync: () => void;
}) {
  const p = usePalette();
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams() as NavParams;
  const user = useAuth((s) => s.user);
  const workspace = useAuth((s) => s.workspace);
  const company = useAuth((s) => s.company);
  const currentFy = useAuth((s) => s.currentFy);
  const logout = useAuth((s) => s.logout);
  const can = usePermission();
  const { online, pendingCount } = useSync();
  const [loggingOut, setLoggingOut] = useState(false);

  const sections: NavSection[] = useMemo(() => {
    const canSee = (permissions?: Permission[]) => {
      if (!workspace) return false;
      if (workspace.isPrimaryAdmin) return true;
      if (!permissions || permissions.length === 0) return true;
      return permissions.some((perm) => workspace.permissions.includes(perm));
    };
    if (isPackerOnlyWorkspace(workspace)) return PACKER_SECTIONS;
    return SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => canSee(item.permissions)),
    })).filter((section) => section.items.length > 0);
  }, [workspace]);

  const go = useCallback(
    (to: string) => {
      onClose();
      router.navigate(to as never);
    },
    [onClose, router],
  );

  const onLogout = useCallback(() => {
    setLoggingOut(true);
    logout()
      .catch((err: unknown) => {
        toastError("Could not sign out", friendlyError(err));
      })
      .finally(() => {
        setLoggingOut(false);
        router.replace("/auth");
      });
  }, [logout, router]);

  const scheme = p.scheme;
  const toggleTheme = () => setScheme(scheme === "dark" ? "light" : "dark");

  return (
    <View className="flex-1" style={{ backgroundColor: p.background }}>
      <SafeAreaView
        edges={["top", "bottom", "left", "right"]}
        style={{ flex: 1 }}
      >
        {/* Brand header */}
        <View className="shrink-0 px-4 pb-3 pt-5">
          <View className="flex-row items-start justify-between gap-2">
            <View className="min-w-0 flex-1 pt-1">
              <Text
                className="text-[24px] font-bold tracking-tight"
                style={{ color: p.foreground }}
                numberOfLines={1}
              >
                KS Biz App
              </Text>
              <View className="mt-1 flex-row items-center gap-1.5">
                <Text
                  className="shrink text-[13px]"
                  style={{ color: p.mutedForeground }}
                  numberOfLines={1}
                >
                  {company?.name ?? workspace?.name ?? COMPANY_DETAILS.name}
                </Text>
                <RoleBadge isPrimaryAdmin={workspace?.isPrimaryAdmin} />
              </View>
            </View>
            <CircleButton onPress={onClose} label="Close navigation">
              <Feather name="x" size={20} color={p.foreground} />
            </CircleButton>
          </View>

          {/* FY + sync strip */}
          <View
            className="mt-4 min-h-[44px] flex-row items-center justify-between gap-2 rounded-lg border px-3"
            style={{ borderColor: p.border, backgroundColor: p.card }}
          >
            <View className="flex-row items-center gap-1.5">
              <Feather name="calendar" size={14} color={p.mutedForeground} />
              <Text
                className="text-xs font-semibold"
                style={{ color: p.mutedForeground }}
              >
                FY {currentFy?.label ?? "—"}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open sync status"
              onPress={onOpenSync}
              className="min-h-[44px] flex-row items-center gap-1.5"
            >
              <Feather
                name={online ? "wifi" : "wifi-off"}
                size={14}
                color={online ? p.success : p.warning}
              />
              <Text
                className="text-xs font-semibold"
                style={{ color: p.primary }}
              >
                {online
                  ? pendingCount > 0
                    ? `${pendingCount} pending`
                    : "Synced"
                  : "Offline"}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Nav tree */}
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-3 py-3"
          showsVerticalScrollIndicator={false}
        >
          {sections.map((section, i) => (
            <View key={section.title} className={i > 0 ? "mt-3" : undefined}>
              <View className="px-2 pb-1 pt-3">
                <Text
                  className="text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: p.mutedForeground }}
                >
                  {section.title}
                </Text>
              </View>
              <View className="gap-0.5">
                {section.items.map((item) => {
                  const hasSubs = !!item.subItems?.length;
                  const active = isItemActive(item, pathname, params);
                  const anySubActive =
                    item.subItems?.some((sub) =>
                      isSubActive(sub, pathname, params),
                    ) ?? false;
                  const isExpanded = expanded[item.to] ?? anySubActive;
                  const emphasised = active || anySubActive;
                  return (
                    <View key={item.to}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ expanded: isExpanded }}
                        onPress={() =>
                          hasSubs ? onToggleGroup(item.to) : go(item.to)
                        }
                        className="min-h-12 flex-row items-center gap-3 rounded-md px-3"
                        style={({ pressed }) => ({
                          backgroundColor: active
                            ? p.accentSoft
                            : pressed
                              ? withAlpha(p.muted, 0.6)
                              : "transparent",
                        })}
                      >
                        <Feather
                          name={item.icon}
                          size={20}
                          color={emphasised ? p.accentInk : p.mutedForeground}
                        />
                        <Text
                          className="min-w-0 flex-1 text-[15px]"
                          numberOfLines={1}
                          style={{
                            color: emphasised ? p.accentInk : p.foreground,
                            fontWeight: emphasised ? "500" : "400",
                          }}
                        >
                          {item.label}
                        </Text>
                        {hasSubs ? (
                          <Feather
                            name={isExpanded ? "chevron-down" : "chevron-right"}
                            size={16}
                            color={p.mutedForeground}
                          />
                        ) : null}
                      </Pressable>

                      {hasSubs && isExpanded ? (
                        <View
                          className="ml-5 flex-col gap-0.5 border-l pl-3"
                          style={{ borderColor: p.border }}
                        >
                          {item.subItems?.map((sub) => {
                            const subActive = isSubActive(
                              sub,
                              pathname,
                              params,
                            );
                            return (
                              <Pressable
                                key={sub.to}
                                accessibilityRole="button"
                                accessibilityState={{ selected: subActive }}
                                onPress={() => go(sub.to)}
                                className="min-h-11 flex-row items-center gap-2.5 rounded-md px-3"
                                style={({ pressed }) => ({
                                  backgroundColor: subActive
                                    ? p.accentSoft
                                    : pressed
                                      ? withAlpha(p.muted, 0.6)
                                      : "transparent",
                                })}
                              >
                                <View
                                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                                  style={{
                                    backgroundColor: subActive
                                      ? p.accentInk
                                      : withAlpha(p.mutedForeground, 0.4),
                                  }}
                                />
                                <Text
                                  className="truncate text-[13px]"
                                  numberOfLines={1}
                                  style={{
                                    color: subActive
                                      ? p.accentInk
                                      : p.mutedForeground,
                                    fontWeight: subActive ? "500" : "400",
                                  }}
                                >
                                  {sub.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Footer */}
        <View
          className="shrink-0 border-t px-4 pt-3"
          style={{ borderColor: p.border }}
        >
          <View className="flex-row items-center justify-between gap-3">
            <View className="min-w-0 flex-1 flex-row items-center gap-2.5">
              <View
                className="h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: p.muted }}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{ color: p.foreground }}
                >
                  {user?.name.slice(0, 1).toUpperCase() ?? "K"}
                </Text>
              </View>
              <View className="min-w-0 leading-tight">
                <Text
                  className="truncate text-[13px] font-medium"
                  style={{ color: p.foreground }}
                  numberOfLines={1}
                >
                  {user?.name}
                </Text>
                <Text
                  className="mt-0.5 truncate text-[11px]"
                  style={{ color: p.mutedForeground }}
                  numberOfLines={1}
                >
                  {workspace?.name}
                </Text>
              </View>
            </View>
            <View className="shrink-0 flex-row items-center gap-2">
              <CircleButton
                onPress={toggleTheme}
                label={scheme === "dark" ? "Light theme" : "Dark theme"}
              >
                <Feather
                  name={scheme === "dark" ? "sun" : "moon"}
                  size={18}
                  color={p.foreground}
                />
              </CircleButton>
              <CircleButton
                onPress={onLogout}
                label="Log out"
                disabled={loggingOut}
              >
                <Feather
                  name="log-out"
                  size={18}
                  color={loggingOut ? p.mutedForeground : p.destructive}
                />
              </CircleButton>
            </View>
          </View>
          {can("create_challan") ? (
            <View className="mt-3">
              <Button
                label="New challan"
                icon="plus"
                onPress={() => {
                  onClose();
                  router.navigate({
                    pathname: "/challan-editor",
                    params: { kind: "sales" },
                  } as never);
                }}
              />
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}
