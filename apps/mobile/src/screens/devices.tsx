import { useCallback, useEffect, useState } from "react";
import { Alert, TextInput, View } from "react-native";
import {
  ChevronDown,
  Globe,
  Monitor,
  Smartphone,
  Trash2,
} from "lucide-react-native";
import { fmtRelative } from "@kataria-syntex/shared";
import {
  friendlyError,
  toastError,
  toastSuccess,
  type Device,
  useAuth,
} from "@kataria-syntex/app-core";

import { Page } from "@/components/page";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CircleButton } from "@/components/ui/circle-button";
import { MorphPanel } from "@/components/ui/disclosure";
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Eyebrow,
  MicroLabel,
  PageDescription,
  PageTitle,
  Text,
} from "@/components/ui/text";

const PLATFORM_LABEL: Record<string, string> = {
  android: "Android app",
  web: "Web browser",
  desktop: "Desktop app",
};

function DeviceIcon({ platform }: { platform: string }) {
  if (platform === "android") return <Smartphone size={20} />;
  if (platform === "web") return <Globe size={20} />;
  return <Monitor size={20} />;
}

function DeviceRow({
  device,
  deleting,
  onRevoke,
}: {
  device: Device;
  deleting: boolean;
  onRevoke: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const platform = PLATFORM_LABEL[device.platform] ?? "App";

  return (
    <View className="flex-row items-start gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <View className="size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
        <DeviceIcon platform={device.platform} />
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="shrink font-semibold text-sm" numberOfLines={1}>
            {device.label}
          </Text>
          {device.isCurrent ? (
            <Text className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              This device
            </Text>
          ) : null}
        </View>
        <Text className="mt-0.5 text-xs text-muted-foreground">
          {platform} · {fmtRelative(device.lastSeenAt)}
        </Text>
        {device.userAgent ? (
          <View className="mt-1">
            <Button
              variant="ghost"
              className="h-8 self-start px-0"
              onPress={() => setDetailsOpen((open) => !open)}
              accessibilityLabel={`Technical details for ${device.label}`}
              accessibilityState={{ expanded: detailsOpen }}
            >
              <ChevronDown size={14} />
              <ButtonText
                variant="ghost"
                className="text-[13px] text-muted-foreground"
              >
                Technical details
              </ButtonText>
            </Button>
            <MorphPanel open={detailsOpen}>
              <Text className="mt-1 font-mono text-[11px] leading-4 text-muted-foreground">
                {device.userAgent}
              </Text>
            </MorphPanel>
          </View>
        ) : null}
      </View>
      {!device.isCurrent ? (
        <CircleButton
          className="border-0"
          disabled={deleting}
          onPress={onRevoke}
          accessibilityLabel={`Revoke ${device.label}`}
          accessibilityState={{ busy: deleting }}
        >
          <Trash2 size={18} />
        </CircleButton>
      ) : null}
    </View>
  );
}

function DevicesSkeleton() {
  return (
    <View>
      {[0, 1, 2].map((row) => (
        <View
          key={row}
          className="flex-row gap-3 border-b border-border px-4 py-3 last:border-b-0"
        >
          <Skeleton className="size-10 rounded-lg" />
          <View className="flex-1 gap-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-48" />
          </View>
        </View>
      ))}
    </View>
  );
}

export function DevicesScreen() {
  const devices = useAuth((state) => state.devices);
  const refreshDevices = useAuth((state) => state.refreshDevices);
  const deleteDevice = useAuth((state) => state.deleteDevice);
  const approveQrLogin = useAuth((state) => state.approveQrLogin);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalCode, setApprovalCode] = useState("");
  const [approving, setApproving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      await refreshDevices();
    } catch (error) {
      setLoadError(friendlyError(error, "Could not load your devices."));
    } finally {
      setLoading(false);
    }
  }, [refreshDevices]);

  useEffect(() => {
    void load();
  }, [load]);

  const revokeConfirmed = async (device: Device) => {
    setDeletingId(device.id);
    try {
      await deleteDevice(device.id);
      toastSuccess("Device session ended.");
    } catch (error) {
      toastError("Could not revoke device", friendlyError(error));
    } finally {
      setDeletingId(null);
    }
  };

  const revoke = (device: Device) => {
    Alert.alert(
      `Revoke ${device.label}?`,
      "That session ends immediately, and it can sign in again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: () => void revokeConfirmed(device),
        },
      ],
    );
  };

  const approve = async () => {
    const code = approvalCode.trim();
    if (!code) return;
    setApproving(true);
    try {
      const result = await approveQrLogin(code);
      setApprovalOpen(false);
      setApprovalCode("");
      toastSuccess(
        result.grantedSelf ? "This device is approved." : "Device approved.",
      );
    } catch (error) {
      toastError("Could not approve device", friendlyError(error));
    } finally {
      setApproving(false);
    }
  };

  const ordered = [...devices].sort((a, b) =>
    a.isCurrent === b.isCurrent ? 0 : a.isCurrent ? -1 : 1,
  );
  const showSkeleton = loading && devices.length === 0;

  return (
    <Page>
      <Eyebrow>Account</Eyebrow>
      <PageTitle className="mt-1.5">Connected Devices</PageTitle>
      <PageDescription className="mt-2">
        Every device signed in to this account. Revoke one you do not recognize.
      </PageDescription>
      {loadError ? (
        <View
          className="mt-5 gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4"
          accessibilityRole="alert"
        >
          <Text className="text-sm text-destructive">{loadError}</Text>
          <Button
            variant="outline"
            className="self-start"
            label="Try again"
            onPress={() => void load()}
            loading={loading}
          />
        </View>
      ) : null}
      <Card className="mt-6 overflow-hidden">
        <View className="flex-row items-center justify-between gap-3 border-b border-border bg-muted px-4 py-3">
          <View>
            <MicroLabel>Signed-in sessions</MicroLabel>
            <Text className="mt-0.5 text-xs text-muted-foreground">
              {ordered.length} {ordered.length === 1 ? "device" : "devices"}
            </Text>
          </View>
          <Button
            variant="outline"
            label="Approve device"
            onPress={() => setApprovalOpen(true)}
          />
        </View>
        {showSkeleton ? <DevicesSkeleton /> : null}
        {!showSkeleton && ordered.length === 0 ? (
          <View className="items-center gap-3 px-6 py-10">
            <View className="size-11 items-center justify-center rounded-full bg-muted">
              <Smartphone size={20} />
            </View>
            <Text className="font-semibold">No devices found</Text>
            <Text className="text-center text-sm text-muted-foreground">
              Approve a new device to sign in from it.
            </Text>
            <Button
              label="Approve device"
              onPress={() => setApprovalOpen(true)}
            />
          </View>
        ) : null}
        {!showSkeleton && ordered.length > 0
          ? ordered.map((device) => (
              <DeviceRow
                key={device.id}
                device={device}
                deleting={deletingId === device.id}
                onRevoke={() => revoke(device)}
              />
            ))
          : null}
      </Card>
      <Sheet open={approvalOpen} onClose={() => setApprovalOpen(false)}>
        <SheetHeader>
          <SheetTitle>Approve a device</SheetTitle>
          <SheetDescription>
            Enter the code shown on the device you want to sign in.
          </SheetDescription>
        </SheetHeader>
        <TextInput
          value={approvalCode}
          onChangeText={setApprovalCode}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Approval code"
          placeholderTextColor="#8b8b8b"
          className="mt-5 h-11 rounded-lg border border-border bg-background px-3 font-sans text-sm text-foreground"
          accessibilityLabel="Approval code"
        />
        <Button
          className="mt-4"
          label="Approve device"
          disabled={!approvalCode.trim()}
          loading={approving}
          onPress={() => void approve()}
        />
      </Sheet>
    </Page>
  );
}
