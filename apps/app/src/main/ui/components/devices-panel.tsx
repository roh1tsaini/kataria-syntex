import { useCallback, useEffect, useState } from "react";

import { ChevronDown, Globe, Monitor, Smartphone, Trash2 } from "lucide-react";
import { QrApproveDialog } from "@/ui/components/qr-approve-dialog";
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
import { Skeleton, Stagger, StaggerItem } from "@/ui/components/motion";
import { useConfirm } from "@/ui/components/confirm-dialog";
import { fmtRelative } from "@/ui/lib/format";
import { cn } from "@/ui/lib/cn";
import {
  useAuth,
  type Device,
  toastError,
  toastSuccess,
  friendlyError,
} from "@kataria-syntex/app-core";

/** Plain names for the three shells — the stored value is a platform token,
 * never something to show a user. */
const PLATFORM_LABEL: Record<string, string> = {
  android: "Android app",
  web: "Web browser",
  desktop: "Desktop app",
};

function platformIcon(platform: string) {
  if (platform === "android")
    return <Smartphone className="size-5" aria-hidden />;
  if (platform === "web") return <Globe className="size-5" aria-hidden />;
  return <Monitor className="size-5" aria-hidden />;
}

/** One session row: what it is, when it was last used, and the one action that
 * matters (revoke). The raw user-agent sits behind a disclosure — it is
 * diagnostic, not part of the decision. */
function DeviceRow({
  device,
  onDelete,
  deleting,
}: {
  device: Device;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const platform = PLATFORM_LABEL[device.platform] ?? "App";

  return (
    <div className="flex items-start gap-3 border-b border-border/65 px-4 py-3 last:border-b-0 sm:px-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        {platformIcon(device.platform)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-semibold">{device.label}</span>
          {device.isCurrent && (
            <Badge
              variant="outline"
              className="border-primary/25 bg-primary/10 text-primary"
            >
              This device
            </Badge>
          )}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {platform} · {fmtRelative(device.lastSeenAt)}
        </div>
        {device.userAgent && (
          <>
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              aria-expanded={detailsOpen}
              className="btn-motion -ml-2 mt-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground touch-44 [@media(hover:hover)]:hover:bg-muted [@media(hover:hover)]:hover:text-foreground"
            >
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform duration-200 ease-[var(--ease-out)]",
                  detailsOpen && "rotate-180",
                )}
                aria-hidden
              />
              Technical details
            </button>
            {detailsOpen && (
              <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-muted-foreground/80">
                {device.userAgent}
              </p>
            )}
          </>
        )}
      </div>
      {!device.isCurrent && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={deleting}
          className="size-11 shrink-0 rounded-full px-0 text-destructive touch-44 sm:h-8 sm:w-auto sm:px-3"
          aria-label={`Revoke ${device.label}`}
        >
          <Trash2 className="size-4" aria-hidden />
          <span className="hidden sm:inline">Revoke</span>
        </Button>
      )}
    </div>
  );
}

/** Shaped like the rows it stands in for (design.md §3.1). */
function DevicesPanelSkeleton() {
  return (
    <div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 border-b border-border/65 px-4 py-3 last:border-b-0 sm:px-5"
        >
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-52" />
          </div>
          {i > 0 && (
            <Skeleton className="size-11 shrink-0 rounded-full sm:h-8 sm:w-20 touch-44" />
          )}
        </div>
      ))}
    </div>
  );
}

/** Signed-in sessions list — shared by the Devices page and the Settings
 * Devices section. One surface, no fork. */
export function DevicesPanel() {
  const devices = useAuth((s) => s.devices);
  const refreshDevices = useAuth((s) => s.refreshDevices);
  const deleteDevice = useAuth((s) => s.deleteDevice);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [qrApproveOpen, setQrApproveOpen] = useState(false);
  const { confirm, dialog } = useConfirm();

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      await refreshDevices();
    } catch (err) {
      setLoadError(friendlyError(err, "Could not load your devices."));
    } finally {
      setLoading(false);
    }
  }, [refreshDevices]);

  useEffect(() => {
    void load();
  }, [load]);

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

  // The session you are on stays at the top; everything else reads newest
  // first (the API lists them most-recent-first).
  const ordered = [...devices].sort((a, b) =>
    a.isCurrent === b.isCurrent ? 0 : a.isCurrent ? -1 : 1,
  );
  const showSkeleton = loading && devices.length === 0;

  return (
    <>
      {loadError && (
        <p
          role="alert"
          className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive"
        >
          {loadError}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            loading={loading}
          >
            Try again
          </Button>
        </p>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted px-4 py-2.5">
          <span className="micro-label">Signed-in sessions</span>
          <span className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="font-medium tabular-nums whitespace-nowrap"
            >
              {ordered.length} {ordered.length === 1 ? "device" : "devices"}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => setQrApproveOpen(true)}
              title="Scan or type the QR code shown on another device to log it in"
            >
              <Smartphone className="size-3.5" aria-hidden />
              Approve a device
            </Button>
          </span>
        </div>
        {showSkeleton ? (
          <DevicesPanelSkeleton />
        ) : ordered.length === 0 ? (
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
          <CardContent className="p-0">
            <Stagger>
              {ordered.map((d) => (
                <StaggerItem key={d.id}>
                  <DeviceRow
                    device={d}
                    deleting={deletingId === d.id}
                    onDelete={() => void onDelete(d.id)}
                  />
                </StaggerItem>
              ))}
            </Stagger>
          </CardContent>
        )}
      </Card>
      <QrApproveDialog open={qrApproveOpen} onOpenChange={setQrApproveOpen} />
      {dialog}
    </>
  );
}
