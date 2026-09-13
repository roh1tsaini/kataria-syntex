/**
 * Devices — the Android port of apps/app's DevicesPage. Connected-session
 * list (label/platform/last seen), "This device" marker, revoke with
 * confirm, QR approve-a-device sheet (code entry + camera scan), and the
 * manage_settings gate (web: ProtectedRoute requirePermission="manage_settings").
 */

import { useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { MorphSheet } from "@/ui/morph-sheet";
import { Feather } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import {
  useAuth,
  usePermission,
  friendlyError,
  toastError,
  toastSuccess,
  type Device,
} from "@kataria-syntex/app-core";
import { usePalette, withAlpha } from "@/theme";
import { useReduceMotion } from "@/lib/motion";
import { confirm } from "@/ui/confirm";
import { Badge, Button, Input, Screen, Skeleton } from "@/ui/kit";
import { SyncStrip } from "@/ui/sync";

function platformIconName(platform: string) {
  if (platform === "android") return "smartphone" as const;
  if (platform === "web") return "globe" as const;
  return "monitor" as const;
}

/** Web Stagger item (lib/motion.ts): fade + 6px rise, 200ms EASE_OUT, 40ms
 * apart — capped at five staggered items. Still under reduced motion. */
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

function StaggerRow({
  index,
  children,
}: {
  index: number;
  children: ReactNode;
}) {
  const reduce = useReduceMotion();
  const progress = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      Math.min(index, 4) * 40,
      withTiming(1, { duration: 200, easing: EASE_OUT }),
    );
  }, [index, reduce, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 6 }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

function DeviceRow({
  device,
  onDelete,
  deleting,
}: {
  device: Device;
  onDelete: () => void;
  deleting: boolean;
}) {
  const p = usePalette();
  return (
    <View
      className="flex-row items-center gap-3 py-3"
      style={{ opacity: deleting ? 0.5 : 1 }}
    >
      <View
        className="h-7 w-7 items-center justify-center rounded-md"
        style={{ backgroundColor: p.muted }}
      >
        <Feather
          name={platformIconName(device.platform)}
          size={16}
          color={p.mutedForeground}
        />
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text
            className="text-[14px] font-medium"
            style={{ color: p.foreground }}
            numberOfLines={1}
          >
            {device.label}
          </Text>
          {device.isCurrent ? (
            <Badge label="This device" tone="accent" />
          ) : null}
        </View>
        <Text className="text-xs" style={{ color: p.mutedForeground }}>
          {device.platform} · last seen{" "}
          {device.lastSeenAt
            ? new Date(device.lastSeenAt).toLocaleString()
            : "unknown"}
        </Text>
        {device.userAgent ? (
          <Text
            className="mt-0.5 text-xs"
            style={{ color: `${p.mutedForeground}bf` }}
            numberOfLines={1}
          >
            {device.userAgent}
          </Text>
        ) : null}
      </View>
      {!device.isCurrent ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: deleting }}
          accessibilityLabel={`Revoke ${device.label}`}
          disabled={deleting}
          onPress={onDelete}
          className="min-h-[44px] shrink-0 justify-center px-2"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <View className="flex-row items-center gap-1.5">
            <Feather name="trash-2" size={16} color={p.destructive} />
            <Text
              className="text-[13px] font-medium"
              style={{ color: p.destructive }}
            >
              Revoke
            </Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Login codes are grouped "XXXX-XXXX-XXXX-XXXX" — same canonical form as
 * web's CodeEntryForm; typed input accepted with or without dashes. */
function canonicalCode(value: string): string {
  const alnum = value.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return (alnum.match(/.{1,4}/g) ?? []).join("-");
}

/** Extracts the login code from a scanned QR payload (an approve-page URL
 * with the code as its last segment; a bare code is accepted too). */
function parseScanResult(data: string): string | null {
  const fromUrl = data.match(/\/login\/scan\/([^/?#\s]+)/);
  const raw = (fromUrl ? decodeURIComponent(fromUrl[1]) : data.trim())
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
  return raw.length >= 4 ? raw : null;
}

/** Approve-a-device sheet — the web QrApproveDialog + CodeEntryForm port:
 * type the code or scan the other device's QR, then approve. */
function ApproveDeviceSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const approveQrLogin = useAuth((s) => s.approveQrLogin);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const p = usePalette();

  useEffect(() => {
    if (!open) {
      setCode("");
      setError(null);
      setApproved(false);
      setScanning(false);
      setScanError(null);
    }
  }, [open]);

  const run = async (raw: string) => {
    setError(null);
    setBusy(true);
    try {
      await approveQrLogin(canonicalCode(raw));
      setApproved(true);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const onScan = ({ data }: { data: string }) => {
    const parsed = parseScanResult(data);
    if (!parsed) return;
    setScanning(false);
    setCode(parsed);
    void run(parsed);
  };

  const canSubmit = code.replace(/[^A-Z0-9]/g, "").length >= 4;

  return (
    <MorphSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Approve a device"
    >
      <View>
        <Text
          className="px-4 pt-1 text-[13px]"
          style={{ color: p.mutedForeground }}
        >
          Make sure the code matches the other device, then approve.
        </Text>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="gap-4 p-4"
        >
          {approved ? (
            <View className="items-center gap-3 py-6">
              <Feather name="check-circle" size={40} color={p.primary} />
              <Text
                className="text-[14px] font-medium"
                style={{ color: p.foreground }}
              >
                Approved. The other device is now logged in.
              </Text>
              <Text className="text-xs" style={{ color: p.mutedForeground }}>
                You can close this sheet.
              </Text>
            </View>
          ) : (
            <>
              <View className="gap-1.5">
                <Text
                  className="text-[13px] font-medium"
                  style={{ color: p.foreground }}
                >
                  Login code
                </Text>
                <Input
                  value={code}
                  onChangeText={(t) =>
                    setCode(t.toUpperCase().replace(/[^A-Z0-9-]/g, ""))
                  }
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  maxLength={19}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (canSubmit && !busy) void run(code);
                  }}
                  accessibilityLabel="Login code"
                />
                <Text className="text-xs" style={{ color: p.mutedForeground }}>
                  Open the login page on the other device and scan its QR code,
                  or enter the code shown below it.
                </Text>
                {error ? (
                  <Text
                    className="text-[12px]"
                    style={{ color: p.destructive }}
                  >
                    {error}
                  </Text>
                ) : null}
              </View>

              {scanning ? (
                <View
                  className="relative overflow-hidden rounded-lg border"
                  style={{
                    borderColor: p.border,
                    backgroundColor: p.foreground,
                  }}
                >
                  <CameraView
                    style={{ width: "100%", aspectRatio: 16 / 9 }}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                    onBarcodeScanned={onScan}
                    onMountError={() =>
                      setScanError(
                        "Camera unavailable. Enter the code manually instead.",
                      )
                    }
                  />
                  <View
                    pointerEvents="none"
                    className="absolute inset-x-0 top-2 items-center"
                  >
                    <Text
                      className="text-xs"
                      style={{ color: withAlpha(p.background, 0.8) }}
                    >
                      Point the camera at the QR code on the other device
                    </Text>
                  </View>
                </View>
              ) : null}
              {scanError ? (
                <Text className="text-xs" style={{ color: p.mutedForeground }}>
                  {scanError}
                </Text>
              ) : null}
              {scanning && cameraPermission && !cameraPermission.granted ? (
                <Button
                  label="Allow camera access"
                  variant="outline"
                  onPress={() => void requestCameraPermission()}
                />
              ) : null}

              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Button
                    label="Approve login"
                    onPress={() => void run(code)}
                    disabled={!canSubmit || busy}
                    loading={busy}
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    scanning ? "Stop camera" : "Scan QR with camera"
                  }
                  disabled={busy}
                  onPress={() => setScanning((s) => !s)}
                  className="h-11 w-11 items-center justify-center rounded-md border"
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    borderColor: p.border,
                  })}
                >
                  <Feather
                    name={scanning ? "camera-off" : "camera"}
                    size={16}
                    color={p.foreground}
                  />
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </MorphSheet>
  );
}

function DevicesPage() {
  const devices = useAuth((s) => s.devices);
  const refreshDevices = useAuth((s) => s.refreshDevices);
  const deleteDevice = useAuth((s) => s.deleteDevice);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [qrApproveOpen, setQrApproveOpen] = useState(false);
  const p = usePalette();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void refreshDevices()
      .catch((err) => {
        if (!cancelled) setLoadError(friendlyError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshDevices]);

  const onDelete = async (id: string) => {
    const device = devices.find((d) => d.id === id);
    const ok = await confirm({
      title: `Revoke ${device?.label ?? "this device"}?`,
      description: "That session ends immediately, and it can sign in again.",
      confirmLabel: "Revoke",
      destructive: true,
    });
    if (!ok) return;
    setDeletingId(id);
    try {
      await deleteDevice(id);
      toastSuccess("Device session ended.");
    } catch (err) {
      toastError("Could not revoke device", friendlyError(err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Screen
      eyebrow="Account"
      title="Devices"
      description="Revoke a session you do not recognize."
      action={
        <Button
          label="Approve a device"
          icon="smartphone"
          onPress={() => setQrApproveOpen(true)}
        />
      }
      banner={<SyncStrip />}
    >
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-8">
        <View
          className="rounded-lg border p-4"
          style={{ backgroundColor: p.card, borderColor: p.border }}
        >
          {loading && devices.length === 0 ? (
            <View className="gap-4">
              {[0, 1].map((i) => (
                <View key={i} className="flex-row items-center gap-3">
                  <Skeleton className="h-7 w-7 rounded-md" />
                  <View className="flex-1 gap-1.5">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </View>
                </View>
              ))}
            </View>
          ) : loadError && devices.length === 0 ? (
            <View className="items-center gap-3 py-10">
              <Text
                className="text-center text-sm"
                style={{ color: p.destructive }}
              >
                {loadError}
              </Text>
              <Button
                label="Retry"
                variant="outline"
                onPress={() => {
                  setLoadError(null);
                  setLoading(true);
                  void refreshDevices()
                    .catch((err) => setLoadError(friendlyError(err)))
                    .finally(() => setLoading(false));
                }}
              />
            </View>
          ) : devices.length === 0 ? (
            <View className="items-center gap-6 py-10">
              <View className="items-center gap-2">
                <View
                  className="h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: p.muted }}
                >
                  <Feather
                    name="smartphone"
                    size={20}
                    color={p.mutedForeground}
                  />
                </View>
                <Text
                  className="text-[15px] font-semibold"
                  style={{ color: p.foreground }}
                >
                  No devices found
                </Text>
                <Text
                  className="text-center text-[14px]"
                  style={{ color: p.mutedForeground }}
                >
                  Pair a new device to sign in from it.
                </Text>
              </View>
              <Button
                label="Approve a device"
                icon="smartphone"
                onPress={() => setQrApproveOpen(true)}
              />
            </View>
          ) : (
            devices.map((d, i) => (
              <View
                key={d.id}
                style={
                  i > 0
                    ? { borderTopWidth: 1, borderTopColor: p.border }
                    : undefined
                }
              >
                <StaggerRow index={i}>
                  <DeviceRow
                    device={d}
                    deleting={deletingId === d.id}
                    onDelete={() => void onDelete(d.id)}
                  />
                </StaggerRow>
              </View>
            ))
          )}
        </View>
      </ScrollView>
      <ApproveDeviceSheet
        open={qrApproveOpen}
        onOpenChange={setQrApproveOpen}
      />
    </Screen>
  );
}

export default function DevicesRoute() {
  const status = useAuth((s) => s.status);
  const can = usePermission();
  const router = useRouter();
  const allowed = can("manage_settings");

  // Same contract as web ProtectedRoute: guest → sign-in, permission miss →
  // home (the "/" gate routes packer-only accounts to packing).
  useEffect(() => {
    if (status === "guest") router.replace("/auth");
    else if (status === "authed" && !allowed) router.replace("/");
  }, [status, allowed, router]);

  if (status !== "authed" || !allowed) return null;
  return <DevicesPage />;
}
