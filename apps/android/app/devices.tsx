/**
 * Devices — the Android port of apps/app's DevicesPage. Connected-session
 * list (label/platform/last seen), "This device" marker, revoke with
 * confirm, QR approve-a-device sheet (code entry + camera scan), and the
 * manage_settings gate (web: ProtectedRoute requirePermission="manage_settings").
 */

import { useEffect, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { MorphSheet } from "@/ui/morph-sheet";
import { Feather } from "@expo/vector-icons";
import {
  useAuth,
  usePermission,
  friendlyError,
  toastError,
  toastSuccess,
  type Device,
} from "@kataria-syntex/app-core";
import { usePalette } from "@/theme";
import { confirm } from "@/ui/confirm";
import { Badge, Button, Input, Screen, Skeleton } from "@/ui/kit";

function platformIconName(platform: string) {
  if (platform === "android") return "smartphone" as const;
  if (platform === "web") return "globe" as const;
  return "monitor" as const;
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
          size={14}
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
            <Feather name="trash-2" size={14} color={p.destructive} />
            <Text
              className="text-[13px] font-semibold"
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
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const p = usePalette();

  useEffect(() => {
    if (!open) {
      setCode("");
      setError(null);
      setApproved(false);
      setScanning(false);
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
            <View className="items-center gap-2 py-8">
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
                  className="overflow-hidden rounded-lg border"
                  style={{ borderColor: p.border }}
                >
                  <CameraView
                    style={{ width: "100%", aspectRatio: 1 }}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                    onBarcodeScanned={onScan}
                  />
                  <View
                    className="items-center py-2"
                    style={{ backgroundColor: p.muted }}
                  >
                    <Text
                      className="text-xs"
                      style={{ color: p.mutedForeground }}
                    >
                      Point the camera at the QR code on the other device
                    </Text>
                  </View>
                </View>
              ) : null}
              {scanning && cameraPermission && !cameraPermission.granted ? (
                <Button
                  label="Allow camera access"
                  variant="secondary"
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
                  className="min-h-[44px] w-[44px] items-center justify-center rounded-lg border"
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    borderColor: p.border,
                  })}
                >
                  <Feather
                    name={scanning ? "x" : "search"}
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
      title="Devices"
      subtitle="Revoke a session you do not recognize."
      action={
        <View className="shrink-0">
          <Button
            label="Approve a device"
            onPress={() => setQrApproveOpen(true)}
            className="min-h-[44px] px-3"
          />
        </View>
      }
    >
      <FlatList
        data={devices}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => (
          <DeviceRow
            device={item}
            deleting={deletingId === item.id}
            onDelete={() => void onDelete(item.id)}
          />
        )}
        ItemSeparatorComponent={() => (
          <View style={{ height: 1, backgroundColor: p.border }} />
        )}
        ListEmptyComponent={
          loading && devices.length === 0 ? (
            <View className="gap-2 px-4 py-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
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
                variant="secondary"
                onPress={() => {
                  setLoadError(null);
                  setLoading(true);
                  void refreshDevices()
                    .catch((err) => setLoadError(friendlyError(err)))
                    .finally(() => setLoading(false));
                }}
              />
            </View>
          ) : (
            <View className="items-center gap-4 py-10">
              <Feather name="smartphone" size={24} color={p.mutedForeground} />
              <View className="items-center gap-1">
                <Text
                  className="text-[15px] font-semibold"
                  style={{ color: p.foreground }}
                >
                  No devices found
                </Text>
                <Text
                  className="text-center text-[13px]"
                  style={{ color: p.mutedForeground }}
                >
                  Pair a new device to sign in from it.
                </Text>
              </View>
              <Button
                label="Approve a device"
                onPress={() => setQrApproveOpen(true)}
              />
            </View>
          )
        }
        contentContainerClassName="px-4 pb-8"
      />
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
