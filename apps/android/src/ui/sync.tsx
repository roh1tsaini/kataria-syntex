/**
 * Sync status for Android — the phone port of apps/app's sync-dialog: a
 * slim banner while offline or queued, and a bottom sheet listing waiting /
 * clashing / failed challans with one-tap fixes (renumber-and-resync,
 * retry).
 */

import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  useSync,
  listPending,
  resubmitWithNumber,
  retryErrored,
  toastSuccess,
  toastError,
  friendlyError,
  ApiError,
  type PendingChallan,
} from "@kataria-syntex/app-core";
import { usePalette } from "@/theme";
import { Button, Input, EmptyState } from "@/ui/kit";
import { MorphSheet } from "@/ui/morph-sheet";

/** Banner + its sheet, self-contained — the shell strip every screen mounts
 *  above its page header (apps/app renders the same pair globally under the
 *  HeaderBar). */
export function SyncStrip() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SyncBanner onOpen={() => setOpen(true)} />
      <SyncSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

export function SyncBanner({ onOpen }: { onOpen: () => void }) {
  const { online, syncing, pendingCount, conflictCount, errorCount } =
    useSync();
  const p = usePalette();
  const issues = conflictCount + errorCount;
  if (online && pendingCount === 0 && issues === 0) return null;

  const tone = issues ? p.destructive : online ? p.primary : p.mutedForeground;
  const label = issues
    ? `${issues} challan${issues === 1 ? "" : "s"} need${issues === 1 ? "s" : ""} attention — tap to fix`
    : online
      ? syncing
        ? `Syncing ${pendingCount} challan${pendingCount === 1 ? "" : "s"}…`
        : `${pendingCount} waiting to sync`
      : pendingCount > 0
        ? `Offline — ${pendingCount} challan${pendingCount === 1 ? "" : "s"} saved on this device`
        : "Offline — you can keep working; saves stay on this device";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpen}
      className="min-h-[44px] flex-row items-center gap-2.5 border-b px-4 py-2"
      style={{ borderColor: p.border }}
    >
      <View
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: tone }}
      />
      <Text className="flex-1 text-xs font-semibold" style={{ color: tone }}>
        {label}
      </Text>
    </Pressable>
  );
}

function StatusChip({ status }: { status: PendingChallan["status"] }) {
  const p = usePalette();
  const label =
    status === "pending"
      ? "Waiting"
      : status === "conflict"
        ? "Number clash"
        : "Failed";
  return (
    <View
      className="self-start rounded-sm px-1.5 py-0.5"
      style={{
        backgroundColor: status === "pending" ? p.muted : `${p.destructive}1a`,
      }}
    >
      <Text
        className="text-[10px] font-bold uppercase tracking-wider"
        style={{
          color: status === "pending" ? p.mutedForeground : p.destructive,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function ConflictRow({
  p,
  onResolved,
}: {
  p: PendingChallan;
  onResolved: () => void;
}) {
  const [value, setValue] = useState(p.suggestion ?? p.challanNumber);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const p0 = usePalette();

  useEffect(() => {
    setValue(p.suggestion ?? p.challanNumber);
  }, [p.suggestion, p.challanNumber]);

  const apply = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await resubmitWithNumber(p.clientRef, value.trim());
      if (!res.ok) {
        setError(
          res.error
            ? friendlyError(new ApiError(0, res.error), res.error)
            : friendlyError(null),
        );
        return;
      }
      onResolved();
      toastSuccess(`Challan ${value.trim()} resolved`);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      className="gap-2 rounded-lg border p-3"
      style={{
        borderColor: `${p0.destructive}40`,
        backgroundColor: `${p0.destructive}0d`,
      }}
    >
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="font-semibold" style={{ color: p0.foreground }}>
          {p.challanNumber}
        </Text>
        <StatusChip status={p.status} />
        <Text className="text-xs" style={{ color: p0.mutedForeground }}>
          {p.local.date} · {p.local.customerName ?? p.local.jobWorkerName}
        </Text>
      </View>
      <Text className="text-xs" style={{ color: p0.mutedForeground }}>
        Another device already used this number. Suggested:{" "}
        <Text className="font-semibold" style={{ color: p0.foreground }}>
          {p.suggestion}
        </Text>
      </Text>
      <View className="flex-row items-center gap-2">
        <View className="w-44">
          <Input
            value={value}
            onChangeText={setValue}
            editable={!busy}
            accessibilityLabel="New challan number"
          />
        </View>
        <Button
          label="Use this number"
          onPress={() => void apply()}
          loading={busy}
          disabled={busy || !value.trim()}
        />
      </View>
      {error ? (
        <Text className="text-xs" style={{ color: p0.destructive }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function ErrorRow({ p }: { p: PendingChallan }) {
  const [busy, setBusy] = useState(false);
  const p0 = usePalette();
  return (
    <View
      className="flex-row flex-wrap items-center gap-2 rounded-lg border p-3"
      style={{ borderColor: p0.border, backgroundColor: p0.muted }}
    >
      <Text className="font-semibold" style={{ color: p0.foreground }}>
        {p.challanNumber}
      </Text>
      <StatusChip status={p.status} />
      <Text className="flex-1 text-xs" style={{ color: p0.mutedForeground }}>
        {friendlyError(p.errorCode ? new ApiError(0, p.errorCode) : null)}
      </Text>
      <Button
        label="Retry"
        variant="secondary"
        loading={busy}
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await retryErrored(p.clientRef);
            toastSuccess("Retry queued.");
          } catch (err) {
            toastError("Could not retry", friendlyError(err));
          } finally {
            setBusy(false);
          }
        }}
      />
    </View>
  );
}

export function SyncSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { online, syncing, pendingCount, conflictCount, errorCount } =
    useSync();
  const [, setTick] = useState(0);
  // Re-read the MMKV snapshot whenever the sheet opens or the counts move —
  // listPending() itself is not reactive.
  useEffect(() => {
    if (open) setTick((t) => t + 1);
  }, [open, pendingCount, conflictCount, errorCount]);
  const pending = listPending();
  const waiting = pending.filter((p0) => p0.status === "pending");
  const conflicts = pending.filter((p0) => p0.status === "conflict");
  const errors = pending.filter((p0) => p0.status === "error");
  const p = usePalette();
  const { height: winH } = useWindowDimensions();

  return (
    <MorphSheet open={open} onOpenChange={onOpenChange} title="Sync status">
      <View className="px-4 pb-4">
        <Text className="mt-1 text-[13px]" style={{ color: p.mutedForeground }}>
          {online
            ? "Connected — queued challans send automatically."
            : "Offline — challans made on this device send automatically once the server is back."}
        </Text>

        <ScrollView
          className="mt-4"
          style={{ maxHeight: winH * 0.68 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-4 pb-2">
            {pending.length === 0 && (
              <EmptyState
                title="Nothing queued"
                message="Everything is saved on the server."
              />
            )}
            {conflicts.length > 0 && (
              <View className="gap-2">
                <Text
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: p.mutedForeground }}
                >
                  Number clashes
                </Text>
                {conflicts.map((p0) => (
                  <ConflictRow
                    key={p0.clientRef}
                    p={p0}
                    onResolved={() => setTick((t) => t + 1)}
                  />
                ))}
              </View>
            )}
            {errors.length > 0 && (
              <View className="gap-2">
                <Text
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: p.mutedForeground }}
                >
                  Failed to sync
                </Text>
                {errors.map((p0) => (
                  <ErrorRow key={p0.clientRef} p={p0} />
                ))}
              </View>
            )}
            {waiting.length > 0 && (
              <View className="gap-2">
                <Text
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: p.mutedForeground }}
                >
                  Waiting to sync{syncing ? " — sending now…" : ""}
                </Text>
                {waiting.map((p0) => (
                  <View
                    key={p0.clientRef}
                    className="flex-row items-center gap-2 rounded-lg border p-3"
                    style={{ borderColor: p.border, backgroundColor: p.muted }}
                  >
                    <Text
                      className="font-semibold"
                      style={{ color: p.foreground }}
                    >
                      {p0.challanNumber}
                    </Text>
                    <StatusChip status={p0.status} />
                    <Text
                      className="flex-1 text-xs"
                      style={{ color: p.mutedForeground }}
                      numberOfLines={1}
                    >
                      {p0.local.date} ·{" "}
                      {p0.local.customerName ?? p0.local.jobWorkerName}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </MorphSheet>
  );
}
