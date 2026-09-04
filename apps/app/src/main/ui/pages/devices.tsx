import { useEffect, useState } from "react";

import { Globe, Monitor, Smartphone, Trash2 } from "lucide-react";
import { useAuth, type Device } from "@/store/auth";

import { toastError, toastSuccess } from "@/store/toast";
import { QrApproveDialog } from "@/ui/components/qr-approve-dialog";
import { PageHeader } from "@/ui/components/page-header";
import { AppShell } from "@/ui/components/app-shell";
import { Button } from "@/ui/components/ui/button";
import { Badge } from "@/ui/components/ui/badge";
import { Card, CardContent } from "@/ui/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/ui/components/ui/empty";
import { Skeleton } from "@/ui/components/motion";
import { Stagger, StaggerItem } from "@/ui/components/motion";
import { useConfirm } from "@/ui/components/confirm-dialog";

import { friendlyError } from "@/ui/lib/errors";

function platformIcon(platform: string) {
  if (platform === "android")
    return <Smartphone className="size-4" aria-hidden />;
  if (platform === "web") return <Globe className="size-4" aria-hidden />;
  return <Monitor className="size-4" aria-hidden />;
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
  return (
    <div className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
      <span className="grid size-7 place-items-center rounded-md bg-muted text-muted-foreground">
        {platformIcon(device.platform)}
      </span>
      <div className="flex-1">
        <div className="text-sm font-medium">
          {device.label}
          {device.isCurrent && (
            <Badge
              variant="outline"
              className="ml-2 border-primary/25 bg-primary/10 text-primary"
            >
              This device
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {device.platform} · last seen{" "}
          {device.lastSeenAt
            ? new Date(device.lastSeenAt).toLocaleString()
            : "unknown"}
        </div>
      </div>
      {!device.isCurrent && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={deleting}
          className="text-destructive"
        >
          {deleting ? (
            <Skeleton
              className="h-4 w-10 rounded-full opacity-60"
              aria-hidden
            />
          ) : (
            <Trash2 className="size-4" aria-hidden />
          )}
          Revoke
        </Button>
      )}
    </div>
  );
}

export function DevicesPage() {
  const devices = useAuth((s) => s.devices);
  const refreshDevices = useAuth((s) => s.refreshDevices);
  const deleteDevice = useAuth((s) => s.deleteDevice);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [qrApproveOpen, setQrApproveOpen] = useState(false);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    void refreshDevices().catch(() => {});
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
    <AppShell>
      <PageHeader
        eyebrow="Account"
        title="Devices"
        description="Revoke a session you do not recognize."
        actions={
          <Button
            onClick={() => setQrApproveOpen(true)}
            title="Scan or type the QR code shown on another device to log it in"
          >
            <Smartphone className="size-4" aria-hidden />
            Approve a device
          </Button>
        }
      />

      <Card className="mt-6">
        <CardContent className="p-4">
          {devices.length === 0 ? (
            <Empty className="px-4 py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Smartphone aria-hidden />
                </EmptyMedia>
                <EmptyTitle>No devices found</EmptyTitle>
                <EmptyDescription>
                  Pair a new device to sign in from it.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => setQrApproveOpen(true)}>
                  <Smartphone aria-hidden />
                  Approve a device
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <Stagger>
              {devices.map((d) => (
                <StaggerItem key={d.id}>
                  <DeviceRow
                    device={d}
                    deleting={deletingId === d.id}
                    onDelete={() => void onDelete(d.id)}
                  />
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </CardContent>
      </Card>
      <QrApproveDialog open={qrApproveOpen} onOpenChange={setQrApproveOpen} />
      {dialog}
    </AppShell>
  );
}

export type RecentChallan = {
  id: string;
  number: string;
  type: "sales" | "outward";
  date: string;
  createdAt: string;
  party: string;
  boxes: number;
  netWt: number;
};
