/**
 * Challan list — the phone port of apps/app's ChallanListPage, shared by the
 * Sales and Job-work tabs (same data via useChallans, same offline-pending
 * flags, same search + FY filter + pagination contract). Presentation is the
 * web mobile register: a filter-bar card, a muted "Issued" header strip, and
 * one 12px card per challan; Prev/Next pagination with no floating action
 * button (the new-challan action lives in the page header, as on the web).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Clipboard,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import type { FeatherIconName } from "@/ui/feather";
import {
  useAuth,
  useChallans,
  usePermission,
  useRealtimeEvent,
  friendlyError,
  toastError,
  toastSuccess,
  type Challan,
} from "@kataria-syntex/app-core";
import { usePalette } from "@/theme";
import { Badge, Button, EmptyState, Screen, Skeleton } from "@/ui/kit";
import { MenuSelect } from "@/ui/controls";
import { SyncStrip } from "@/ui/sync";
import { MorphSheet } from "@/ui/morph-sheet";
import { confirm } from "@/ui/confirm";
import { printChallanPdf } from "@/lib/pdf";
import { countLabel, fmtBoxes, fmtWt } from "@/lib/format";
import type { ChallanKind } from "@/lib/challan-kinds";
import { MORPH, useReduceMotion } from "@/lib/motion";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const LIST_PAGE_SIZE = 25;

function SyncFlag({ challan }: { challan: Challan }) {
  const p = usePalette();
  if (challan.conflict) {
    return (
      <View
        className="flex-row items-center gap-1 self-start rounded-sm border px-1.5 py-0.5"
        style={{
          borderColor: `${p.destructive}33`,
          backgroundColor: `${p.destructive}1a`,
        }}
      >
        <Feather name="alert-triangle" size={11} color={p.destructive} />
        <Text
          className="text-[11px] font-medium uppercase tracking-wider"
          style={{ color: p.destructive }}
        >
          {challan.suggestion ? "Clash" : "Failed"}
        </Text>
      </View>
    );
  }
  if (challan.pendingSync) {
    return (
      <View
        className="flex-row items-center gap-1 self-start rounded-sm border px-1.5 py-0.5"
        style={{ borderColor: p.border, backgroundColor: p.muted }}
      >
        <Feather name="cloud-off" size={11} color={p.mutedForeground} />
        <Text
          className="text-[11px] font-medium uppercase tracking-wider"
          style={{ color: p.mutedForeground }}
        >
          To sync
        </Text>
      </View>
    );
  }
  return null;
}

function ListRow({
  item,
  onMore,
  animate,
}: {
  item: Challan;
  onMore: (challan: Challan) => void;
  /** False for the list's first batch — those rows appear immediately so 25+
   *  rows don't animate at once and jank the initial paint. */
  animate: boolean;
}) {
  const p = usePalette();
  const router = useRouter();
  const kind = item.type;
  // Row entrance: fade + 14px rise on the morph spring (§5.6). Starting at 1
  // (not 0) is what keeps the first batch from painting invisible for a frame.
  const entering = useSharedValue(animate ? 0 : 1);
  const reduce = useReduceMotion();
  useEffect(() => {
    if (!animate) return;
    entering.value = reduce
      ? withTiming(1, { duration: 1 })
      : withSpring(1, MORPH);
  }, [animate, entering, reduce]);
  const enterStyle = useAnimatedStyle(() => ({
    opacity: entering.value,
    transform: [{ translateY: (1 - entering.value) * 14 }],
  }));
  const party =
    kind === "sales" ? (item.customerName ?? "—") : (item.jobWorkerName ?? "—");
  return (
    <Animated.View style={enterStyle}>
      <View
        className="flex-row items-start overflow-hidden rounded-lg border"
        style={{ backgroundColor: p.card, borderColor: p.border }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.challanNumber}, ${party}`}
          onPress={() =>
            router.push({
              pathname: "/challan-detail",
              params: { id: item.id, kind },
            })
          }
          className="min-w-0 flex-1 p-4"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Text
              className="text-sm font-bold tracking-tight"
              style={{ color: p.primary, fontFamily: "monospace" }}
            >
              {item.challanNumber}
            </Text>
            <Badge label={item.fyLabel} />
            <SyncFlag challan={item} />
          </View>
          <View className="mt-1 flex-row items-center gap-1.5">
            <Feather name="calendar" size={12} color={p.mutedForeground} />
            <Text
              className="text-xs font-medium tabular-nums"
              style={{ color: p.mutedForeground }}
            >
              {item.date}
            </Text>
            <View
              className="h-1 w-1 rounded-full"
              style={{ backgroundColor: p.border }}
            />
            <Text
              className="flex-1 text-xs font-semibold"
              style={{ color: p.foreground }}
              numberOfLines={1}
            >
              {party}
            </Text>
          </View>
          {item.type === "sales" && item.customerGstin ? (
            <Text
              className="mt-1 text-[11px] tabular-nums"
              style={{ color: p.mutedForeground }}
              numberOfLines={1}
            >
              GSTIN {item.customerGstin}
            </Text>
          ) : null}
          <View className="mt-3 flex-row gap-2">
            <View
              className="flex-1 rounded-md px-3 py-2"
              style={{ backgroundColor: p.muted }}
            >
              <Text
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: p.mutedForeground }}
              >
                Boxes
              </Text>
              <Text
                className="mt-0.5 text-sm font-bold tabular-nums"
                style={{ color: p.foreground }}
              >
                {fmtBoxes(item.totalBoxes)}
              </Text>
            </View>
            <View
              className="flex-1 rounded-md px-3 py-2"
              style={{ backgroundColor: p.muted }}
            >
              <Text
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: p.mutedForeground }}
              >
                Net wt
              </Text>
              <Text
                className="mt-0.5 text-sm font-bold tabular-nums"
                style={{ color: p.primary }}
              >
                {fmtWt(item.totalNetWt)}{" "}
                <Text
                  className="text-xs font-medium"
                  style={{ color: p.mutedForeground }}
                >
                  kg
                </Text>
              </Text>
            </View>
          </View>
        </Pressable>
        <View className="shrink-0 pb-2.5 pr-2.5 pt-2.5">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Actions for ${item.challanNumber}`}
            onPress={() => onMore(item)}
            hitSlop={8}
            className="h-11 w-11 items-center justify-center rounded-full"
            style={({ pressed }) => ({
              backgroundColor: pressed ? p.muted : "transparent",
            })}
          >
            <Feather
              name="more-horizontal"
              size={18}
              color={p.mutedForeground}
            />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

/** One row of the per-challan action sheet. */
function ActionRow({
  icon,
  label,
  onPress,
  destructive,
  disabled,
}: {
  icon: FeatherIconName;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      className="min-h-[44px] flex-row items-center gap-3 rounded-md px-2"
      style={({ pressed }) => ({
        opacity: disabled ? 0.5 : pressed ? 0.6 : 1,
      })}
    >
      <Feather
        name={icon}
        size={18}
        color={destructive ? p.destructive : p.mutedForeground}
      />
      <Text
        className="text-[15px] font-medium"
        style={{ color: destructive ? p.destructive : p.foreground }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function RowSkeleton() {
  const p = usePalette();
  return (
    <View className="rounded-lg border p-4" style={{ borderColor: p.border }}>
      <View className="flex-row items-center gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-14" />
      </View>
      <Skeleton className="mt-2 h-3 w-48" />
      <View className="mt-3 flex-row gap-2">
        <Skeleton className="h-12 flex-1 rounded-md" />
        <Skeleton className="h-12 flex-1 rounded-md" />
      </View>
    </View>
  );
}

export function ChallanList({ kind }: { kind: ChallanKind }) {
  const { total, error, refresh, remove } = useChallans();
  const financialYears = useAuth((s) => s.financialYears);
  const currentFy = useAuth((s) => s.currentFy);
  const can = usePermission();
  const router = useRouter();
  const p = usePalette();

  const [rows, setRows] = useState<Challan[]>([]);
  const [fy, setFy] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionChallan, setActionChallan] = useState<Challan | null>(null);
  const [printing, setPrinting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const initializedFy = useRef(false);
  const seqRef = useRef(0);
  // The first batch of rows appears immediately; rows mounted after that
  // animate in (see ListRow). Flips once the first load has settled.
  const [animateRows, setAnimateRows] = useState(false);
  useEffect(() => {
    if (busy) return;
    const t = setTimeout(() => setAnimateRows(true), 0);
    return () => clearTimeout(t);
  }, [busy]);
  const canCreate = can("create_challan");
  const canEdit = can("edit_challan");
  const canDelete = can("delete_challan");
  const pageCount = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));

  const fyOptions = useMemo(
    () => [
      { value: "", label: "All financial years" },
      ...financialYears.map((f) => ({ value: f.label, label: f.label })),
    ],
    [financialYears],
  );

  // ── Row actions (the web RowMenu: Open · Print · Edit · Copy ID · Delete) ──

  const openChallan = (challan: Challan) => {
    setActionChallan(null);
    router.push({
      pathname: "/challan-detail",
      params: { id: challan.id, kind: challan.type },
    });
  };

  const printChallan = async (challan: Challan) => {
    setActionChallan(null);
    setPrinting(true);
    try {
      await printChallanPdf(challan.id, challan.challanNumber);
    } catch (err) {
      toastError(
        "Could not print",
        friendlyError(err, "Something went wrong."),
      );
    } finally {
      setPrinting(false);
    }
  };

  const editChallan = (challan: Challan) => {
    setActionChallan(null);
    router.push({
      pathname: "/challan-editor",
      params: { kind: challan.type, id: challan.id },
    });
  };

  const copyChallanId = async (challan: Challan) => {
    setActionChallan(null);
    try {
      Clipboard.setString(challan.id);
      toastSuccess("Challan ID copied.");
    } catch {
      toastError("Could not copy", "Clipboard is unavailable on this device.");
    }
  };

  const deleteChallan = async (challan: Challan) => {
    setActionChallan(null);
    const ok = await confirm({
      title: `Delete ${kind.singular} ${challan.challanNumber}?`,
      description: "This permanently removes the challan and its lines.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await remove(challan.id);
      toastSuccess(`${challan.challanNumber} deleted.`);
      setPage(1);
      void loadPage(1, { fy, q });
    } catch (err) {
      toastError(
        "Could not delete",
        friendlyError(err, "Something went wrong."),
      );
    } finally {
      setDeleting(false);
    }
  };

  // Default the FY filter to the workspace's current financial year once the
  // company profile has loaded (same behavior as the web list).
  useEffect(() => {
    if (!initializedFy.current && currentFy) {
      initializedFy.current = true;
      setFy(currentFy.label);
    }
  }, [currentFy]);

  // Filters always reset the register to page one, exactly like the web list.
  useEffect(() => {
    setPage(1);
  }, [fy, q, kind.type]);

  // The store's refresh() replaces its rows per page; a monotonic seq
  // discards responses superseded by a newer load. Rows stay on screen while
  // a page loads (the web register never blanks mid-pagination).
  const loadPage = useCallback(
    async (nextPage: number, filter: { fy: string; q: string }) => {
      const seq = ++seqRef.current;
      setBusy(true);
      setLoadError(null);
      try {
        await refresh({
          type: kind.type,
          fy: filter.fy || undefined,
          q: filter.q.trim() || undefined,
          page: nextPage,
          limit: LIST_PAGE_SIZE,
        });
      } catch (err) {
        if (seq !== seqRef.current) return;
        setLoadError(friendlyError(err, "Something went wrong."));
        setBusy(false);
        return;
      }
      if (seq !== seqRef.current) return;
      setRows(useChallans.getState().challans);
      setBusy(false);
    },
    [kind.type, refresh],
  );

  // Load the active page on focus and whenever the filter or page moves —
  // search is debounced like the web list.
  useFocusEffect(
    useCallback(() => {
      const delay = q.trim() ? 200 : 0;
      const t = setTimeout(() => {
        void loadPage(page, { fy, q });
      }, delay);
      return () => clearTimeout(t);
    }, [fy, q, page, loadPage]),
  );

  // Other devices' challan writes land here live; this device's writes
  // already refresh through the store's mutation paths.
  useRealtimeEvent(["challans", "stock"], () => {
    void loadPage(page, { fy, q });
  });

  const countText = busy
    ? "Refreshing…"
    : `${total.toLocaleString("en-IN")} ${total === 1 ? "record" : "records"} • FY ${fy || "All"}`;

  return (
    <Screen
      eyebrow={kind.type === "sales" ? "Dispatch register" : "Dyeing movement"}
      title={kind.title}
      description={kind.desc}
      action={
        canCreate ? (
          <Button
            label="New challan"
            icon="plus"
            onPress={() =>
              router.push({
                pathname: "/challan-editor",
                params: { kind: kind.type },
              })
            }
          />
        ) : undefined
      }
      banner={<SyncStrip />}
    >
      <View className="flex-1">
        {/* Filter bar — one card holding search + FY select (design.md §3) */}
        <View
          className="mx-4 rounded-lg border p-3"
          style={{ backgroundColor: p.card, borderColor: p.border }}
        >
          <View
            className="min-h-[44px] flex-row items-center rounded-md border px-1.5"
            style={{ backgroundColor: p.card, borderColor: p.input }}
          >
            <Feather
              name="search"
              size={16}
              color={p.mutedForeground}
              style={{ marginHorizontal: 8 }}
            />
            <TextInput
              accessibilityLabel="Search challans"
              placeholder={`${kind.searchPlaceholder} or challan #`}
              placeholderTextColor={p.mutedForeground}
              value={q}
              onChangeText={setQ}
              returnKeyType="search"
              className="min-h-[44px] flex-1 text-[15px]"
              style={{ color: p.foreground }}
            />
            {q ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setQ("")}
                className="min-h-[44px] min-w-[44px] items-center justify-center"
              >
                <Feather name="x" size={16} color={p.mutedForeground} />
              </Pressable>
            ) : null}
          </View>
          <View className="mt-3">
            <MenuSelect
              value={fy}
              options={fyOptions}
              onChange={setFy}
              leadingIcon="calendar"
              placeholder="All FYs"
              accessibilityLabel="Financial year"
            />
          </View>
        </View>

        {/* Mobile count line */}
        <View className="mt-2 flex-row items-center px-4">
          <Text
            className="text-xs tabular-nums"
            style={{ color: p.mutedForeground }}
          >
            {countText}
          </Text>
          {q ? (
            <Text
              className="ml-2 flex-1 text-right text-xs"
              numberOfLines={1}
              style={{ color: p.mutedForeground }}
            >
              for “{q}”
            </Text>
          ) : null}
        </View>

        {error || loadError ? (
          <View
            className="mx-4 mt-4 gap-2 rounded-lg border px-4 py-3"
            style={{
              borderColor: `${p.destructive}33`,
              backgroundColor: `${p.destructive}14`,
            }}
          >
            <Text className="text-sm" style={{ color: p.destructive }}>
              {loadError ?? error}
            </Text>
            <Button
              label="Retry"
              variant="secondary"
              onPress={() => void loadPage(page, { fy, q })}
            />
          </View>
        ) : null}

        {/* Register card */}
        <View
          className="mx-4 mt-4 flex-1 overflow-hidden rounded-lg border"
          style={{ backgroundColor: p.card, borderColor: p.border }}
        >
          <View
            className="flex-row items-center justify-between border-b px-4 py-2.5"
            style={{ borderColor: p.border, backgroundColor: p.muted }}
          >
            <Text
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: p.mutedForeground }}
            >
              Issued • {rows.length > 0 ? `${rows.length} shown` : "register"}
            </Text>
            <Text className="text-[11px]" style={{ color: p.mutedForeground }}>
              {kind.party}
            </Text>
          </View>

          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ListRow
                item={item}
                onMore={setActionChallan}
                animate={animateRows}
              />
            )}
            contentContainerStyle={{
              gap: 12,
              padding: 12,
              paddingBottom: 24,
            }}
            ListEmptyComponent={
              busy && rows.length === 0 ? (
                <View className="gap-3">
                  <RowSkeleton />
                  <RowSkeleton />
                  <RowSkeleton />
                </View>
              ) : (
                <View className="gap-3">
                  <EmptyState
                    title={`${kind.emptyHint}${fy ? ` for FY ${fy}` : ""}.`}
                    message="Start a new challan to add it to this register."
                  />
                  {canCreate ? (
                    <Button
                      label="Create challan"
                      onPress={() =>
                        router.push({
                          pathname: "/challan-editor",
                          params: { kind: kind.type },
                        })
                      }
                    />
                  ) : null}
                </View>
              )
            }
            refreshControl={
              <RefreshControl
                refreshing={busy && rows.length > 0}
                onRefresh={() => void loadPage(page, { fy, q })}
              />
            }
          />
        </View>

        {/* Pagination — same Prev/Next contract as the web register */}
        {pageCount > 1 ? (
          <View className="mx-4 mb-4 mt-4 items-center gap-3">
            <View className="w-full flex-row items-center gap-2">
              <View className="flex-1">
                <Button
                  label="Prev"
                  variant="secondary"
                  disabled={page <= 1 || busy}
                  onPress={() => setPage((n) => Math.max(1, n - 1))}
                />
              </View>
              <Text
                className="text-xs font-medium tabular-nums"
                style={{ color: p.mutedForeground }}
              >
                {page} / {pageCount}
              </Text>
              <View className="flex-1">
                <Button
                  label="Next"
                  variant="secondary"
                  disabled={page >= pageCount || busy}
                  onPress={() => setPage((n) => Math.min(pageCount, n + 1))}
                />
              </View>
            </View>
            <Text
              className="text-xs tabular-nums"
              style={{ color: p.mutedForeground }}
            >
              Page {page} of {pageCount.toLocaleString("en-IN")} ·{" "}
              {countLabel(total, "record", "records")} total
            </Text>
          </View>
        ) : null}
      </View>

      <MorphSheet
        open={actionChallan !== null}
        onOpenChange={(next) => {
          if (!next) setActionChallan(null);
        }}
        title={actionChallan?.challanNumber}
      >
        {actionChallan ? (
          <View className="gap-0.5 px-4 pb-6 pt-2">
            <ActionRow
              icon="eye"
              label="Open"
              onPress={() => openChallan(actionChallan)}
            />
            <ActionRow
              icon="printer"
              label="Print"
              disabled={printing}
              onPress={() => void printChallan(actionChallan)}
            />
            {!actionChallan.pendingSync && canEdit ? (
              <ActionRow
                icon="edit-2"
                label="Edit"
                onPress={() => editChallan(actionChallan)}
              />
            ) : null}
            <ActionRow
              icon="copy"
              label="Copy ID"
              onPress={() => void copyChallanId(actionChallan)}
            />
            {canDelete ? (
              <ActionRow
                icon="trash-2"
                label="Delete"
                destructive
                disabled={deleting}
                onPress={() => void deleteChallan(actionChallan)}
              />
            ) : null}
          </View>
        ) : null}
      </MorphSheet>
    </Screen>
  );
}
