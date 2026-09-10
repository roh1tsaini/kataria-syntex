/**
 * Update surfaces — the Android counterpart of apps/app's update-surface +
 * update-dialog: a dismissible banner when a newer version is published
 * (live download progress while the APK streams, dismiss deferred per
 * version), and an undismissable blocking dialog when the server raises the
 * 426 floor (minAppVersion) or the manifest publishes minVersion.
 */

import { Linking, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { formatUpdateProgress } from "@kataria-syntex/shared";
import { useUpdates } from "@/lib/updates";
import { apiBaseUrl } from "@/lib/core-adapter";
import { usePalette } from "@/theme";
import { Button } from "@/ui/kit";

export function UpdateBanner() {
  const {
    status,
    latestVersion,
    progress,
    dismissedVersion,
    installUpdate,
    dismiss,
  } = useUpdates();
  const p = usePalette();
  // Deferred versions stay dismissed — the banner returns when a different
  // version ships, not on every launch.
  if (!latestVersion || latestVersion === dismissedVersion) return null;
  if (status !== "ready" && status !== "downloading") return null;
  return (
    <View
      className="flex-row items-center justify-between gap-3 px-4 py-2.5"
      style={{ backgroundColor: p.accentSoft }}
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
      <Pressable
        accessibilityRole="button"
        onPress={() => void installUpdate()}
        disabled={status === "downloading"}
        className="min-h-[36px] justify-center px-1"
      >
        <Text
          className="text-[13px] font-semibold"
          style={{ color: p.accentInk }}
        >
          {status === "downloading" ? "Updating…" : "Update"}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss update notice"
        onPress={dismiss}
        disabled={status === "downloading"}
        className="min-h-[44px] min-w-[44px] items-center justify-center"
      >
        <Feather name="x" size={16} color={p.accentInk} />
      </Pressable>
    </View>
  );
}

export function UpdateBlockingDialog() {
  const { requiredMinVersion, status, progress, installUpdate } = useUpdates();
  const p = usePalette();
  // The download page lives on the app Worker's SPA (same origin as the API).
  // Relative URLs are invalid for Linking — never open a half-built link.
  const downloadUrl = apiBaseUrl() ? `${apiBaseUrl()}/download` : null;
  if (!requiredMinVersion) return null;
  const downloading = status === "downloading";
  return (
    <View
      className="absolute inset-0 items-center justify-center p-6"
      style={{ backgroundColor: `${p.background}f0` }}
    >
      <View
        className="w-full max-w-sm gap-4 rounded-xl border p-5"
        style={{ backgroundColor: p.card, borderColor: p.border }}
      >
        <Text
          className="text-[17px] font-semibold"
          style={{ color: p.foreground }}
        >
          Update required
        </Text>
        <Text className="text-[13px]" style={{ color: p.mutedForeground }}>
          Version {requiredMinVersion} or newer is required to keep using the
          app. Install the latest version to continue.
        </Text>
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
            Download failed. Check your connection and try again.
          </Text>
        )}
        {downloadUrl && (
          <Text
            className="text-[11px]"
            style={{ color: p.mutedForeground }}
            onPress={() => {
              void Linking.openURL(downloadUrl).catch(() => undefined);
            }}
          >
            Or download the APK from the website.
          </Text>
        )}
      </View>
    </View>
  );
}

export function UpdateSurface() {
  return (
    <>
      <UpdateBanner />
      <UpdateBlockingDialog />
    </>
  );
}
