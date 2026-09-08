/**
 * Challan detail — the Android port of apps/app's challans-detail route.
 * Serves both kinds via the `kind` param (sales | outward).
 *
 * Behavior parity with apps/app/src/main/ui/pages/challans-detail.tsx:
 * useChallans().load with not_found handling, party + summary cards, line
 * items as cards, notes block, conflict/pending-sync badges with the sync
 * sheet (the web shows sync state through its shell banner + dialog), and
 * the same action set — PDF share, print, permission-gated edit (hidden for
 * pending challans), destructive-confirmed delete. The web's desktop item
 * table collapses into the same mobile card list it already renders <640px.
 */

import { useEffect, useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  useAuth,
  useChallans,
  usePermission,
  ApiError,
  friendlyError,
  toastError,
  type ChallanItem,
} from "@kataria-syntex/app-core";
import { usePalette } from "@/theme";
import { Badge, Button, EmptyState, Screen, Skeleton } from "@/ui/kit";
import { SyncBanner, SyncSheet } from "@/ui/sync";
import { shareChallanPdf, printChallanPdf } from "@/lib/pdf";
import { RecipeLinkButton } from "./colors";

// ── Kind descriptors (mirror of the editor's map) ───────────────────────────

type DetailKind = {
  type: "sales" | "outward";
  singular: string;
  party: string;
  listTitle: string;
};

const KINDS: Record<"sales" | "outward", DetailKind> = {
  sales: {
    type: "sales",
    singular: "sales challan",
    party: "Customer",
    listTitle: "sales challans",
  },
  outward: {
    type: "outward",
    singular: "job-work challan",
    party: "Job worker",
    listTitle: "job-work challans",
  },
};

// ── Format helpers (port of web ui/lib/format) ──────────────────────────────

const fmtBoxes = (n: number): string => n.toLocaleString("en-IN");
const fmtWt = (n: number): string =>
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
const fmtDate = (iso: string): string => {
  // Date-only strings ("2026-09-03") parse as UTC midnight — construct the
  // date from its parts so timezones west of UTC don't render the previous
  // day.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = dateOnly
    ? new Date(
        Number(iso.slice(0, 4)),
        Number(iso.slice(5, 7)) - 1,
        Number(iso.slice(8, 10)),
      )
    : new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// ── Line item card (the web's <640px mobile card) ───────────────────────────

function ItemCard({ item, index }: { item: ChallanItem; index: number }) {
  const p = usePalette();
  return (
    <View
      className="rounded-lg border p-4"
      style={{ backgroundColor: p.card, borderColor: p.border }}
    >
      <View className="flex-row items-start justify-between gap-2">
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          <View
            className="h-7 w-7 shrink-0 items-center justify-center rounded-md"
            style={{ backgroundColor: p.muted }}
          >
            <Text
              className="text-xs font-bold"
              style={{ color: p.mutedForeground }}
            >
              {index + 1}
            </Text>
          </View>
          <View className="min-w-0">
            <View className="flex-row items-center gap-1">
              <Text
                className="shrink text-sm font-semibold"
                style={{ color: p.foreground }}
                numberOfLines={1}
              >
                {item.denierName}
              </Text>
              <RecipeLinkButton
                colorId={item.colorId}
                denierId={item.denierId}
              />
            </View>
            <View className="mt-1 flex-row items-center gap-1.5">
              <View
                className="h-2.5 w-2.5 shrink-0 rounded-full border"
                style={{
                  borderColor: p.border,
                  backgroundColor: item.colorCode || "transparent",
                }}
              />
              <Text
                className="text-xs"
                style={{ color: p.mutedForeground }}
                numberOfLines={1}
              >
                {item.colorName}
                {item.lotNo ? ` • Lot ${item.lotNo}` : ""}
              </Text>
            </View>
          </View>
        </View>
        <View className="shrink-0 items-end">
          <View className="flex-row items-baseline gap-1">
            <Text className="text-sm font-bold" style={{ color: p.foreground }}>
              {fmtWt(item.netWt)}
            </Text>
            <Text
              className="text-xs font-medium"
              style={{ color: p.mutedForeground }}
            >
              kg
            </Text>
          </View>
          <Text className="mt-0.5 text-xs" style={{ color: p.mutedForeground }}>
            {fmtBoxes(item.boxes)} {item.boxes === 1 ? "box" : "boxes"}
          </Text>
        </View>
      </View>
      {item.boxNo || item.remarks ? (
        <View className="mt-2 flex-row flex-wrap gap-1.5">
          {item.boxNo ? (
            <View
              className="rounded px-2 py-1"
              style={{ backgroundColor: p.secondary }}
            >
              <Text
                className="text-xs font-medium"
                style={{ color: p.secondaryForeground }}
              >
                Box {item.boxNo}
              </Text>
            </View>
          ) : null}
          {item.remarks ? (
            <View
              className="rounded px-2 py-1"
              style={{ backgroundColor: p.muted }}
            >
              <Text className="text-xs" style={{ color: p.mutedForeground }}>
                {item.remarks}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ── Screen ──────────────────────────────────────────────────────────────────

export default function ChallanDetailScreen() {
  const params = useLocalSearchParams<{
    kind?: string | string[];
    id?: string | string[];
  }>();
  const router = useRouter();
  const kindParam = Array.isArray(params.kind) ? params.kind[0] : params.kind;
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const kind = KINDS[kindParam === "outward" ? "outward" : "sales"];

  const { detail, load, remove, clearDetail } = useChallans();
  const company = useAuth((s) => s.company);
  const canEdit = usePermission()("edit_challan");

  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    void load(id).catch((err) => {
      if (err instanceof ApiError && err.code === "not_found") {
        setNotFound(true);
        return;
      }
      setError(friendlyError(err, "Something went wrong."));
    });
  }, [id, load]);

  // Never let a previously-loaded challan leak into this (or another) route.
  useEffect(() => clearDetail, [clearDetail]);

  const onDelete = async () => {
    if (!id) return;
    setDeleteOpen(false);
    setDeleting(true);
    try {
      await remove(id);
      router.back();
    } catch (err) {
      // Toast only — a failed delete must not tear down the detail view.
      toastError(
        "Could not delete",
        friendlyError(err, "Something went wrong."),
      );
    } finally {
      setDeleting(false);
    }
  };

  const onSharePdf = async () => {
    if (!id || !detail) return;
    setDownloading(true);
    try {
      await shareChallanPdf(id, detail.challan.challanNumber);
    } catch (err) {
      // Cancelled share sheets land here too — only real failures toast.
      if (err instanceof Error && err.message === "User did not share") return;
      toastError(
        "Could not share PDF",
        friendlyError(err, "Something went wrong."),
      );
    } finally {
      setDownloading(false);
    }
  };

  const onPrint = async () => {
    if (!id || !detail) return;
    setPrinting(true);
    try {
      await printChallanPdf(id, detail.challan.challanNumber);
    } catch (err) {
      toastError(
        "Could not print",
        friendlyError(err, "Something went wrong."),
      );
    } finally {
      setPrinting(false);
    }
  };

  const p = usePalette();

  if (notFound) {
    return (
      <Screen title="Challan not found">
        <View className="flex-1 px-4">
          <EmptyState
            title="Challan not found"
            message={`This ${kind.singular} was deleted from another device, or the link you opened is stale.`}
          />
          <Button
            label={`Back to ${kind.listTitle}`}
            variant="secondary"
            onPress={() => router.back()}
          />
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen title="Challan">
        <View className="flex-1 px-4">
          <Text className="text-sm" style={{ color: p.destructive }}>
            {error}
          </Text>
          <View className="mt-3">
            <Button
              label="Back"
              variant="secondary"
              onPress={() => router.back()}
            />
          </View>
        </View>
      </Screen>
    );
  }

  if (!detail) {
    return (
      <Screen title="Challan">
        <View className="flex-1 gap-3 px-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3 w-36" />
          <View className="mt-2 flex-row gap-3">
            <Skeleton className="h-28 flex-1 rounded-lg" />
            <Skeleton className="h-28 flex-1 rounded-lg" />
          </View>
          <Skeleton className="h-64 rounded-lg" />
        </View>
      </Screen>
    );
  }

  const { challan, items } = detail;
  const party = kind.type === "sales" ? detail.customer : detail.jobWorker;
  const partyName =
    kind.type === "sales" ? challan.customerName : challan.jobWorkerName;

  return (
    <Screen
      title={challan.challanNumber}
      subtitle={`${challan.date} · ${company?.name ?? "This device"}`}
    >
      <View className="flex-1">
        <SyncBanner onOpen={() => setSyncOpen(true)} />

        <ScrollView contentContainerClassName="px-4 pb-8">
          <View className="flex-row flex-wrap items-center gap-2">
            <Badge label={`FY ${challan.fyLabel}`} />
            {challan.conflict ? (
              <Badge label="Clash" tone="destructive" />
            ) : challan.pendingSync ? (
              <Badge label="Waiting to sync" />
            ) : null}
          </View>

          {/* Actions */}
          <View className="mt-4 flex-row flex-wrap gap-2">
            <Button
              label="Share PDF"
              variant="secondary"
              loading={downloading}
              onPress={() => void onSharePdf()}
              className="min-w-[120px] flex-1"
            />
            <Button
              label="Print"
              variant="secondary"
              loading={printing}
              onPress={() => void onPrint()}
              className="min-w-[100px] flex-1"
            />
            {!challan.pendingSync && canEdit ? (
              <Button
                label="Edit"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/challan-editor",
                    params: { kind: kind.type, id: challan.id },
                  })
                }
                className="min-w-[100px] flex-1"
              />
            ) : null}
            <Button
              label="Delete"
              variant="destructive"
              loading={deleting}
              onPress={() => setDeleteOpen(true)}
              className="min-w-[100px] flex-1"
            />
          </View>

          {/* Party + summary */}
          <View className="mt-4 gap-3">
            <View
              className="rounded-xl border p-4"
              style={{ backgroundColor: p.card, borderColor: p.border }}
            >
              <Text
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: p.mutedForeground }}
              >
                {kind.party}
              </Text>
              <Text
                className="mt-2 text-[15px] font-bold"
                style={{ color: p.foreground }}
              >
                {partyName}
              </Text>
              {kind.type === "sales" && challan.customerGstin ? (
                <View
                  className="mt-1 self-start rounded px-2 py-1"
                  style={{ backgroundColor: p.muted }}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{ color: p.foreground }}
                  >
                    GSTIN {challan.customerGstin}
                  </Text>
                </View>
              ) : null}
              {party?.address ? (
                <Text
                  className="mt-2 text-sm"
                  style={{ color: p.mutedForeground }}
                >
                  {party.address}
                </Text>
              ) : null}
              {party?.phone ? (
                <Text
                  className="mt-1 text-sm font-medium"
                  style={{ color: p.mutedForeground }}
                >
                  {party.phone}
                </Text>
              ) : null}
            </View>

            <View
              className="rounded-xl border p-4"
              style={{ backgroundColor: p.card, borderColor: p.border }}
            >
              <Text
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: p.mutedForeground }}
              >
                Summary
              </Text>
              <View className="mt-2 flex-row flex-wrap items-baseline gap-2">
                <Text
                  className="text-[22px] font-bold"
                  style={{ color: p.foreground }}
                >
                  {fmtBoxes(challan.totalBoxes)}
                </Text>
                <Text
                  className="text-sm font-medium"
                  style={{ color: p.mutedForeground }}
                >
                  boxes
                </Text>
                <Text style={{ color: p.mutedForeground }}>·</Text>
                <Text
                  className="text-[22px] font-bold"
                  style={{ color: p.primary }}
                >
                  {fmtWt(challan.totalNetWt)}
                </Text>
                <Text
                  className="text-sm font-medium"
                  style={{ color: p.mutedForeground }}
                >
                  kg
                </Text>
              </View>
              <Text
                className="mt-2 text-xs"
                style={{ color: p.mutedForeground }}
              >
                {items.length} {items.length === 1 ? "line" : "lines"} • FY{" "}
                {challan.fyLabel}
              </Text>
            </View>
          </View>

          {/* Line items */}
          <View
            className="mt-4 overflow-hidden rounded-xl border"
            style={{ backgroundColor: p.card, borderColor: p.border }}
          >
            <View
              className="flex-row items-center justify-between border-b px-4 py-3"
              style={{ borderColor: p.border, backgroundColor: p.muted }}
            >
              <Text
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: p.mutedForeground }}
              >
                Line items
              </Text>
              <Badge
                label={`${items.length} ${items.length === 1 ? "item" : "items"}`}
              />
            </View>
            <View className="gap-3 p-3">
              {items.map((i, idx) => (
                <ItemCard key={i.id} item={i} index={idx} />
              ))}
              <View
                className="flex-row items-center justify-between rounded-lg p-4"
                style={{ backgroundColor: p.muted }}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{ color: p.foreground }}
                >
                  Total
                </Text>
                <Text
                  className="text-sm font-bold"
                  style={{ color: p.foreground }}
                >
                  {fmtBoxes(challan.totalBoxes)} boxes •{" "}
                  {fmtWt(challan.totalNetWt)} kg
                </Text>
              </View>
            </View>
          </View>

          {/* Notes */}
          {challan.notes ? (
            <View
              className="mt-3 rounded-lg border p-4"
              style={{ borderColor: p.border, backgroundColor: p.muted }}
            >
              <Text className="text-sm">
                <Text className="font-semibold" style={{ color: p.foreground }}>
                  Notes:{" "}
                </Text>
                <Text style={{ color: p.mutedForeground }}>
                  {challan.notes}
                </Text>
              </Text>
            </View>
          ) : null}

          {/* Record meta — created/updated stamps (web shows none; the DTO
              carries them and the owner asked for the meta here). */}
          <View
            className="mt-3 rounded-lg border p-4"
            style={{ backgroundColor: p.card, borderColor: p.border }}
          >
            <Text
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: p.mutedForeground }}
            >
              Record
            </Text>
            <Text
              className="mt-1.5 text-xs"
              style={{ color: p.mutedForeground }}
            >
              Created {fmtDate(challan.createdAt)} · Updated{" "}
              {fmtDate(challan.updatedAt)}
            </Text>
            <Text
              className="mt-0.5 text-xs"
              style={{ color: p.mutedForeground }}
            >
              Issued by{" "}
              {challan.createdBy === "this-device"
                ? "this device"
                : challan.createdBy.length > 14
                  ? `${challan.createdBy.slice(0, 14)}…`
                  : challan.createdBy}
            </Text>
          </View>
        </ScrollView>
      </View>

      {/* Delete confirm — port of the web confirm-dialog behavior */}
      <Modal
        visible={deleteOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteOpen(false)}
      >
        <View
          className="flex-1 items-center justify-center p-6"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
        >
          <View
            className="w-full max-w-sm rounded-xl border p-4"
            style={{ backgroundColor: p.card, borderColor: p.border }}
          >
            <View className="flex-row items-start gap-3">
              <View
                className="h-10 w-10 items-center justify-center rounded-md"
                style={{ backgroundColor: `${p.destructive}1a` }}
              >
                <Feather
                  name="alert-triangle"
                  size={20}
                  color={p.destructive}
                />
              </View>
              <View className="flex-1">
                <Text
                  className="text-[15px] font-semibold"
                  style={{ color: p.foreground }}
                >
                  Delete {kind.singular} {challan.challanNumber}?
                </Text>
                <Text
                  className="mt-1 text-[13px]"
                  style={{ color: p.mutedForeground }}
                >
                  This permanently removes the challan and its lines.
                </Text>
              </View>
            </View>
            <View className="mt-4 flex-row justify-end gap-2">
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => setDeleteOpen(false)}
              />
              <Button
                label="Delete"
                variant="destructive"
                onPress={() => void onDelete()}
              />
            </View>
          </View>
        </View>
      </Modal>

      <SyncSheet open={syncOpen} onOpenChange={setSyncOpen} />
    </Screen>
  );
}
