/**
 * Challan list — the phone port of apps/app's ChallanListPage, shared by the
 * Sales and Job-work tabs (same data via useChallans, same offline-pending
 * flags, same search + FY filter + pagination contract). Presentation is
 * mobile cards on a FlatList: infinite scroll via onEndReached, FAB for new
 * challans. Rows navigate to the shared /challan-detail route.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Clipboard,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
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
  type ChallanType,
} from "@kataria-syntex/app-core";
import { usePalette } from "@/theme";
import { Badge, Button, EmptyState, Skeleton } from "@/ui/kit";
import { SyncBanner, SyncSheet } from "@/ui/sync";
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
        className="self-start rounded-sm border px-1.5 py-0.5"
        style={{
          borderColor: `${p.destructive}4d`,
          backgroundColor: `${p.destructive}1a`,
        }}
      >
        <Text
          className="text-[10px] font-bold uppercase tracking-wider"
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
        className="self-start rounded-sm border px-1.5 py-0.5"
        style={{ borderColor: p.border, backgroundColor: p.muted }}
      >
        <Text
          className="text-[10px] font-bold uppercase tracking-wider"
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.challanNumber}, ${party}`}
        onPress={() =>
          router.push({
            pathname: "/challan-detail",
            params: { id: item.id, kind },
          })
        }
        className="rounded-xl border"
        style={({ pressed }) => ({
          backgroundColor: p.card,
          borderColor: p.border,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View className="p-4">
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Text
              className="text-sm font-bold tracking-tight"
              style={{ color: p.primary, fontFamily: "monospace" }}
            >
              {item.challanNumber}
            </Text>
            <Badge label={item.fyLabel} />
            <SyncFlag challan={item} />
            <View className="flex-1" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Actions for ${item.challanNumber}`}
              onPress={() => onMore(item)}
              hitSlop={8}
              className="-mr-2 -mt-2 h-11 w-11 items-center justify-center rounded-full"
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
          <View className="mt-1 flex-row items-center gap-1.5">
            <Feather name="calendar" size={12} color={p.mutedForeground} />
            <Text
              className="text-xs font-medium"
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
              {item.type === "sales" ? item.customerName : item.jobWorkerName}
            </Text>
          </View>
          {item.type === "sales" && item.customerGstin ? (
            <Text
              className="mt-1 text-[11px]"
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
                className="mt-0.5 text-sm font-bold"
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
                className="mt-0.5 text-sm font-bold"
                style={{ color: p.primary }}
              >
                {fmtWt(item.totalNetWt)} kg
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
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
    <View className="rounded-xl border p-4" style={{ borderColor: p.border }}>
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const [actionChallan, setActionChallan] = useState<Challan | null>(null);
  const [printing, setPrinting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const initializedFy = useRef(false);
  const loadingMoreRef = useRef(false);
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

  // The store's refresh() replaces its rows per page, so pages accumulate in
  // local state: page 1 replaces, deeper pages append (deduped by id). A
  // monotonic seq discards responses superseded by a newer load.
  const loadPage = useCallback(
    async (nextPage: number, filter: { fy: string; q: string }) => {
      const seq = ++seqRef.current;
      if (nextPage === 1) {
        setBusy(true);
        setPageError(null);
      } else {
        setPageError(null);
      }
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
        if (nextPage > 1) setPageError(friendlyError(err));
        return;
      } finally {
        if (nextPage === 1 && seq === seqRef.current) setBusy(false);
      }
      if (seq !== seqRef.current) return;
      const fresh = useChallans.getState().challans;
      if (nextPage === 1) {
        setRows(fresh);
        return;
      }
      setRows((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...fresh.filter((r) => !seen.has(r.id))];
      });
    },
    [kind.type, refresh],
  );

  // Load page 1 on focus (first focus included) and whenever the filters
  // change — search is debounced like the web list. Resetting the page keeps
  // the accumulated rows consistent with the new filter.
  useFocusEffect(
    useCallback(() => {
      const delay = q.trim() ? 200 : 0;
      const t = setTimeout(() => {
        setPage(1);
        void loadPage(1, { fy, q });
      }, delay);
      return () => clearTimeout(t);
    }, [fy, q, loadPage]),
  );

  // Other devices' challan writes land here live; this device's writes
  // already refresh through the store's mutation paths.
  useRealtimeEvent(["challans", "stock"], () => {
    setPage(1);
    void loadPage(1, { fy, q });
  });

  const onEndReached = useCallback(() => {
    if (loadingMoreRef.current || busy || page >= pageCount) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setPage(page + 1);
    void loadPage(page + 1, { fy, q }).finally(() => {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    });
  }, [busy, page, pageCount, fy, q, loadPage]);

  return (
    <View className="flex-1">
      <SyncBanner onOpen={() => setSyncOpen(true)} />
      <View className="gap-2 px-4 pb-3">
        <View
          className="min-h-[44px] flex-row items-center rounded-lg border px-1.5"
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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => setFy("")}
            className="rounded-full border px-3.5"
            style={({ pressed }) => ({
              minHeight: 44,
              justifyContent: "center",
              backgroundColor: fy === "" ? p.primary : p.card,
              borderColor: fy === "" ? p.primary : p.border,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text
              className="text-[13px] font-semibold"
              style={{ color: fy === "" ? p.primaryForeground : p.foreground }}
            >
              All FYs
            </Text>
          </Pressable>
          {financialYears.map((f) => {
            const active = fy === f.label;
            return (
              <Pressable
                key={f.label}
                accessibilityRole="button"
                onPress={() => setFy(active ? "" : f.label)}
                className="rounded-full border px-3.5"
                style={({ pressed }) => ({
                  minHeight: 44,
                  justifyContent: "center",
                  backgroundColor: active ? p.primary : p.card,
                  borderColor: active ? p.primary : p.border,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text
                  className="text-[13px] font-semibold"
                  style={{
                    color: active ? p.primaryForeground : p.foreground,
                  }}
                >
                  FY {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text className="text-xs" style={{ color: p.mutedForeground }}>
          {busy
            ? "Refreshing…"
            : `${total.toLocaleString("en-IN")} ${total === 1 ? "record" : "records"} • FY ${fy || "All"}`}
          {q.trim() ? ` for “${q.trim()}”` : ""}
        </Text>
        {error ? (
          <View
            className="gap-2 rounded-lg border px-4 py-3"
            style={{
              borderColor: `${p.destructive}33`,
              backgroundColor: `${p.destructive}14`,
            }}
          >
            <Text className="text-sm" style={{ color: p.destructive }}>
              {error}
            </Text>
            <Button
              label="Retry"
              variant="secondary"
              onPress={() => {
                setPage(1);
                void loadPage(1, { fy, q });
              }}
            />
          </View>
        ) : null}
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
          paddingHorizontal: 16,
          paddingBottom: 96,
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
        ListFooterComponent={
          loadingMore ? (
            <View className="items-center py-3">
              <Text className="text-xs" style={{ color: p.mutedForeground }}>
                Loading more…
              </Text>
            </View>
          ) : pageError ? (
            <View className="items-center gap-2 py-3">
              <Text className="text-xs" style={{ color: p.destructive }}>
                {pageError}
              </Text>
              <Button
                label="Retry"
                variant="secondary"
                onPress={() => void onEndReached()}
              />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={busy && rows.length > 0}
            onRefresh={() => {
              setPage(1);
              void loadPage(1, { fy, q });
            }}
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={onEndReached}
      />

      {canCreate ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`New ${kind.type === "sales" ? "sales" : "job-work"} challan`}
          onPress={() =>
            router.push({
              pathname: "/challan-editor",
              params: { kind: kind.type },
            })
          }
          className="absolute bottom-6 right-4 h-14 w-14 items-center justify-center rounded-full"
          style={({ pressed }) => ({
            backgroundColor: p.primary,
            opacity: pressed ? 0.8 : 1,
            elevation: 4,
          })}
        >
          <Feather name="plus" size={24} color={p.primaryForeground} />
        </Pressable>
      ) : null}

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

      <SyncSheet open={syncOpen} onOpenChange={setSyncOpen} />
    </View>
  );
}
