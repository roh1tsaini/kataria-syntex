/**
 * Update surfaces — the Android counterpart of apps/app's update-surface +
 * update-dialog: a dismissible banner when a newer version is published,
 * and an undismissable blocking dialog when the server raises the 426 floor
 * (minAppVersion) or the manifest publishes minVersion.
 */

import { Linking, Pressable, Text, View } from "react-native";
import { useUpdates } from "@/lib/updates";
import { usePalette } from "@/theme";
import { Button } from "@/ui/kit";

export function UpdateBanner() {
  const { status, latestVersion, installUpdate } = useUpdates();
  const p = usePalette();
  if (status !== "ready") return null;
  return (
    <View
      className="flex-row items-center justify-between gap-3 px-4 py-2.5"
      style={{ backgroundColor: p.accentSoft }}
    >
      <Text className="flex-1 text-[13px]" style={{ color: p.accentInk }}>
        Version {latestVersion} is available.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void installUpdate()}
        className="min-h-[36px] justify-center"
      >
        <Text
          className="text-[13px] font-semibold"
          style={{ color: p.accentInk }}
        >
          Update
        </Text>
      </Pressable>
    </View>
  );
}

export function UpdateBlockingDialog() {
  const { requiredMinVersion, status, percent, installUpdate } = useUpdates();
  const p = usePalette();
  if (!requiredMinVersion) return null;
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
        <Button
          label={
            status === "downloading"
              ? `Downloading… ${percent != null ? `${Math.round(percent)}%` : ""}`
              : "Update app"
          }
          onPress={() => void installUpdate()}
          disabled={status === "downloading"}
          loading={status === "downloading"}
        />
        {status === "error" && (
          <Text className="text-[12px]" style={{ color: p.destructive }}>
            Download failed. Check your connection and try again.
          </Text>
        )}
        <Text
          className="text-[11px]"
          style={{ color: p.mutedForeground }}
          onPress={() =>
            void Linking.openURL("/download").catch(() => undefined)
          }
        >
          Or download the APK from the website.
        </Text>
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
