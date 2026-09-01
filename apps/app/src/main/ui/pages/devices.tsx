import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Globe, Monitor, Smartphone, Trash2 } from "lucide-react";
import { useAuth, type Device } from "@/store/auth";
import { api, ApiError } from "@/lib/api";
import { toastError, toastSuccess } from "@/store/toast";
import { QrApproveDialog } from "@/ui/components/qr-approve-dialog";
import { PageHeader } from "@/ui/components/page-header";
import { AppShell } from "@/ui/components/app-shell";
import { Button } from "@/ui/components/ui/button";
import { Badge } from "@/ui/components/ui/badge";
import { Card, CardContent } from "@/ui/components/ui/card";
import { Skeleton } from "@/ui/components/motion";
import { Stagger, StaggerItem } from "@/ui/components/motion";
import { useConfirm } from "@/ui/components/confirm-dialog";
import { cn } from "@/ui/lib/cn";
import { EASE_OUT } from "@/ui/lib/motion";
import { fmtBoxes, fmtWt } from "@/ui/lib/format";
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
      <span className="grid size-7 place-items-center rounded-lg bg-muted text-muted-foreground">
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
      description:
        "The session on that device ends immediately. It can sign in again if needed.",
      confirmLabel: "Revoke",
      destructive: true,
    });
    if (!ok) return;
    setDeletingId(id);
    try {
      await deleteDevice(id);
      toastSuccess(
        "Device revoked",
        "The session on that device has been ended.",
      );
    } catch (err) {
      toastError("Could not revoke device", friendlyError(err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Account & devices"
        title="Devices"
        description="Devices with an active session. Revoke any device you do not recognize."
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
            <div className="flex flex-col items-center py-10 text-center">
              <div className="grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground">
                <Smartphone className="size-5" aria-hidden />
              </div>
              <p className="mt-3 text-[15px] font-semibold">
                No devices found.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Pair a new device to sign in from it.
              </p>
            </div>
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
