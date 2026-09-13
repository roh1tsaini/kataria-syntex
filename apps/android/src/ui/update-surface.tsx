/**
 * Update surfaces — the Android counterpart of apps/app's update-surface +
 * update-dialog: a dismissible banner when a newer version is published
 * (live download progress while the APK streams, dismiss deferred per
 * version), and an undismissable blocking dialog when the server raises the
 * 426 floor (minAppVersion) or the manifest publishes minVersion.
 */

import { useEffect, useState } from "react";
import {
  Linking,
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
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatUpdateProgress } from "@kataria-syntex/shared";
import { useUpdates } from "@/lib/updates";
import { apiBaseUrl } from "@/lib/core-adapter";
import { EASE_OUT, MORPH, MORPH_EXIT, useReduceMotion } from "@/lib/motion";
import { SHADOWS, usePalette, withAlpha, SCRIM } from "@/theme";
import { Button } from "@/ui/kit";

export function UpdateBanner() {
  const {
    status,
    latestVersion,
    progress,
    dismissedVersion,
    requiredMinVersion,
    installUpdate,
    dismiss,
  } = useUpdates();
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  // Deferred versions stay dismissed — the banner returns when a different
  // version ships, not on every launch. A required update owns the window
  // through the blocking dialog instead.
  const visible =
    !requiredMinVersion &&
    !!latestVersion &&
    latestVersion !== dismissedVersion &&
    (status === "ready" || status === "downloading");

  // Web animates height + opacity in and out (200ms EASE_OUT); the strip
  // stays mounted through its exit so the exit mirrors the entry.
  const [mounted, setMounted] = useState(visible);
  const reveal = useSharedValue(0);
  const contentH = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      reveal.value = withTiming(1, {
        duration: reduce ? 0 : 200,
        easing: EASE_OUT,
      });
      return;
    }
    if (!mounted) return;
    reveal.value = withTiming(
      0,
      { duration: reduce ? 0 : 200, easing: EASE_OUT },
      (finished) => {
        if (finished) runOnJS(setMounted)(false);
      },
    );
  }, [visible, mounted, reduce, reveal]);

  const shell = useAnimatedStyle(() => ({
    height: reveal.value * contentH.value,
    opacity: reveal.value,
  }));

  if (!mounted || !latestVersion) return null;

  return (
    <Animated.View style={[styles.clip, shell]}>
      {/* Absolute so it measures its natural height even while the animated
          shell is clipped to 0 — the strip animates up from nothing. */}
      <View style={styles.measure}>
        {/* design.md §3: a full-width strip directly under the title bar
            (here the top of the window), hairline bottom, 44px minimum. */}
        <View
          className="min-h-[44px] flex-row items-center justify-between gap-3 border-b px-4 pb-2.5"
          style={{
            backgroundColor: p.accentSoft,
            borderBottomColor: p.border,
            borderBottomWidth: StyleSheet.hairlineWidth,
            paddingTop: insets.top + 10,
          }}
          onLayout={(event) => {
            contentH.value = event.nativeEvent.layout.height;
          }}
        >
          <Text
            className="flex-1 text-[13px] tabular-nums"
            style={{ color: p.accentInk }}
            numberOfLines={2}
          >
            {status === "downloading" && progress
              ? `Updating… ${formatUpdateProgress(progress)}`
              : `Version ${latestVersion} is available.`}
          </Text>
          <View className="shrink-0 flex-row items-center gap-1.5">
            <Button
              size="sm"
              label={status === "downloading" ? "Updating…" : "Update"}
              onPress={() => void installUpdate()}
              disabled={status === "downloading"}
              loading={status === "downloading"}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss update notice"
              onPress={dismiss}
              disabled={status === "downloading"}
              className="h-11 w-11 items-center justify-center rounded-md"
            >
              <Feather name="x" size={16} color={p.mutedForeground} />
            </Pressable>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

export function UpdateBlockingDialog() {
  const { requiredMinVersion, status, progress, installUpdate } = useUpdates();
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const reduce = useReduceMotion();
  // The download page lives on the app Worker's SPA (same origin as the API).
  // Relative URLs are invalid for Linking — never open a half-built link.
  const downloadUrl = apiBaseUrl() ? `${apiBaseUrl()}/download` : null;
  const visible = !!requiredMinVersion;

  // Bottom-sheet grammar (§3/§5.6): the panel springs the full path up from
  // the bottom edge and exits on the same path ~20% faster. Undismissable —
  // no close, no backdrop tap, back button is a no-op (426 floor).
  const [mounted, setMounted] = useState(visible);
  const slide = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      slide.value = reduce
        ? withTiming(1, { duration: 0 })
        : withSpring(1, MORPH);
      return;
    }
    if (!mounted) return;
    const done = (finished?: boolean) => {
      if (finished) runOnJS(setMounted)(false);
    };
    slide.value = reduce
      ? withTiming(0, { duration: 0 }, done)
      : withSpring(0, MORPH_EXIT, done);
  }, [visible, mounted, reduce, slide]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - slide.value) * winH }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: slide.value,
  }));

  if (!mounted || !requiredMinVersion) return null;
  const downloading = status === "downloading";
  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={() => {}}
      statusBarTranslucent
    >
      <View className="flex-1 justify-end">
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            backdropStyle,
            { backgroundColor: SCRIM },
          ]}
        />
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
              paddingBottom: 24 + insets.bottom,
              overflow: "hidden",
            },
          ]}
        >
          <View className="gap-4 px-4 pt-5">
            <View className="flex-row items-start gap-3">
              <View
                className="h-10 w-10 shrink-0 items-center justify-center rounded-md"
                style={{ backgroundColor: withAlpha(p.primary, 0.1) }}
              >
                <Feather name="refresh-cw" size={20} color={p.primary} />
              </View>
              <View className="min-w-0 flex-1 gap-1">
                <Text
                  className="text-[17px] font-semibold"
                  style={{ color: p.foreground }}
                >
                  Update required
                </Text>
                <Text
                  className="text-[13px]"
                  style={{ color: p.mutedForeground }}
                >
                  Version {requiredMinVersion} or newer is required to keep
                  using the app. Install the latest version to continue.
                </Text>
              </View>
            </View>
            {downloading && progress && (
              <Text
                className="text-center text-[12px] tabular-nums"
                style={{ color: p.mutedForeground }}
              >
                {formatUpdateProgress(progress)}
              </Text>
            )}
            <Button
              label={downloading ? "Downloading…" : "Update app"}
              onPress={() => void installUpdate()}
              disabled={downloading}
              loading={downloading}
            />
            {status === "error" && (
              <Text className="text-[12px]" style={{ color: p.destructive }}>
                If Android opened install settings, allow installs from this
                source, then try again. Otherwise check your connection.
              </Text>
            )}
            {downloadUrl && (
              <Pressable
                accessibilityRole="link"
                onPress={() => {
                  void Linking.openURL(downloadUrl).catch(() => undefined);
                }}
                className="min-h-[44px] justify-center"
              >
                <Text
                  className="text-[11px]"
                  style={{ color: p.mutedForeground }}
                >
                  Or download the APK from the website.
                </Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  measure: { position: "absolute", left: 0, right: 0, top: 0 },
});
