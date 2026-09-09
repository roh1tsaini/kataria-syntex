/**
 * Challan list — the phone port of apps/app's ChallanListPage, shared by the
 * Sales and Job-work tabs (same data via useChallans, same offline-pending
 * flags, same search + FY filter + pagination contract). Presentation is
 * mobile cards on a FlatList: infinite scroll via onEndReached, FAB for new
 * challans. Rows navigate to the shared /challan-detail route.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import {
  useAuth,
  useChallans,
  usePermission,
  type Challan,
  type ChallanType,
} from "@kataria-syntex/app-core";
import { usePalette } from "@/theme";
import { Badge, Button, EmptyState, Skeleton } from "@/ui/kit";
import { fmtBoxes, fmtWt } from "@/lib/format";
import { MORPH, useReduceMotion } from "@/lib/motion";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

export type ChallanKind = {
  type: ChallanType;
  title: string;
  desc: string;
  /** Row header label for the counterparty column. */
  party: string;
  searchPlaceholder: string;
  emptyHint: string;
};

export const SALES_KIND: ChallanKind = {
  type: "sales",
  title: "Sales challans",
  desc: "Create, edit and print.",
  party: "Customer",
  searchPlaceholder: "Search customer",
  emptyHint: "No challans found",
};

export const OUTWARD_KIND: ChallanKind = {
  type: "outward",
  title: "Job-work challans",
  desc: "Outward movement to job workers, no rates.",
  party: "Job worker",
  searchPlaceholder: "Search job worker",
  emptyHint: "No job-work challans found",
};

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

function ListRow({ item }: { item: Challan }) {
  const p = usePalette();
  const router = useRouter();
  const kind = item.type;
  // Row entrance: fade + 14px rise on the morph spring (§5.6). Rows added
  // by sync or draft saves grow the list smoothly; existing rows are not
  // re-animated (FlatList reuses them).
  const entering = useSharedValue(0);
  const reduce = useReduceMotion();
  useEffect(() => {
    entering.value = reduce
      ? withTiming(1, { duration: 1 })
      : withSpring(1, MORPH);
  }, [entering, reduce]);
  const enterStyle = useAnimatedStyle(() => ({
    opacity: entering.value,
    transform: [{ translateY: (1 - entering.value) * 14 }],
  }));
  return (
    <Animated.View style={enterStyle}>
      <Pressable
        accessibilityRole="button"
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
                {item.type === "sales" ? "Boxes" : "Sacks"}
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
  const { total, error, refresh } = useChallans();
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
  const initializedFy = useRef(false);
  const loadingMoreRef = useRef(false);
  const seqRef = useRef(0);
  const canCreate = can("create_challan");
  const pageCount = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));

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
      if (nextPage === 1) setBusy(true);
      try {
        await refresh({
          type: kind.type,
          fy: filter.fy || undefined,
          q: filter.q.trim() || undefined,
          page: nextPage,
          limit: LIST_PAGE_SIZE,
        });
      } finally {
        if (nextPage === 1) setBusy(false);
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
              minHeight: 36,
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
                  minHeight: 36,
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
          <Text
            className="rounded-lg border px-4 py-3 text-sm"
            style={{
              color: p.destructive,
              borderColor: `${p.destructive}33`,
              backgroundColor: `${p.destructive}14`,
            }}
          >
            {error}
          </Text>
        ) : null}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ListRow item={item} />}
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
          ) : null
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
    </View>
  );
}
