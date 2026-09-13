/**
 * Stock — the Android port of apps/app's StockPage (mobile-cards variant).
 * One route serves both kinds via the "kind" param ("raw" | "dyed", default
 * dyed — web: /stock/raw and /stock/dyed). Same API call, same workspace-
 * keyed module cache registered with registerDataCache (stale-while-
 * revalidate; wiped on logout/401), search, totals, and view_stock gate
 * (web: ProtectedRoute requirePermission="view_stock").
 *
 * Presentation mirrors the web mobile register: one filter-bar card, a
 * count line, then a card with a muted "Lots • N shown" strip and one morph
 * row per group — collapsed to denier/colour + net weight, springing open
 * for lot + movement detail (design.md §5.6).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  api,
  useAuth,
  usePermission,
  registerDataCache,
  friendlyError,
  useRealtimeEvent,
} from "@kataria-syntex/app-core";
import { usePalette } from "@/theme";
import { countLabel, fmtWt } from "@/lib/format";
import { MORPH, MORPH_EXIT, useReduceMotion } from "@/lib/motion";
import { Badge, Button, EmptyState, Input, Screen, Skeleton } from "@/ui/kit";
import { AppIcon, Warehouse, type IconValue } from "@/ui/feather";
import { SyncStrip } from "@/ui/sync";

type StockGroup = {
  denierId: string | null;
  denierName: string;
  colorId: string | null;
  colorName: string;
  colorCode: string | null;
  lotNo: string;
  totalWt: number;
  movements: number;
};

type StockType = "raw" | "dyed";

// Keyed by workspace id so one account's stock never leaks into another's.
// Registered so account resets (logout/401) wipe it — see lib/data-caches.
const stockCache: Record<string, Record<StockType, StockGroup[] | null>> = {};
registerDataCache(() => {
  for (const key of Object.keys(stockCache)) delete stockCache[key];
});

const rowKey = (item: StockGroup, idx: number) =>
  `${item.denierId ?? "x"}-${item.colorId ?? "x"}-${item.lotNo}-${idx}`;

/** Collapsible stock card: radius steps 12px → 16px while open (design.md
 *  §5.6), body height/opacity ride the morph spring, still under reduced
 *  motion. Collapsed shows denier/colour + net weight; open adds lot and
 *  movement detail — the web mobile MorphPanel. */
function StockPanel({
  item,
  open,
  onToggle,
}: {
  item: StockGroup;
  open: boolean;
  onToggle: () => void;
}) {
  const p = usePalette();
  const reduce = useReduceMotion();
  const progress = useSharedValue(0);
  // The body stays mounted at height 0 so its natural size can be measured —
  // the open height springs between 0 and that measurement.
  const [bodyHeight, setBodyHeight] = useState(0);

  useEffect(() => {
    progress.value = reduce
      ? withTiming(open ? 1 : 0, { duration: 1 })
      : withSpring(open ? 1 : 0, open ? MORPH : MORPH_EXIT);
  }, [open, reduce, progress]);

  const panelStyle = useAnimatedStyle(() => ({
    borderRadius: 12 + progress.value * 4,
  }));
  const bodyStyle = useAnimatedStyle(() => ({
    height: bodyHeight * progress.value,
    opacity: progress.value,
  }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  return (
    <Animated.View
      className="overflow-hidden border"
      style={[{ backgroundColor: p.card, borderColor: p.border }, panelStyle]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.denierName}, ${item.colorName}`}
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        className="flex-row items-center justify-between gap-3 px-4 py-3"
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <View className="flex-1 flex-row items-start justify-between gap-2">
          <View className="min-w-0 flex-1">
            <View className="flex-row flex-wrap items-center gap-1.5">
              <Text
                className="text-[14px] font-semibold"
                style={{ color: p.foreground }}
              >
                {item.denierName}
              </Text>
              {item.colorCode ? (
                <View
                  className="h-3 w-3 shrink-0 rounded-full border"
                  style={{
                    backgroundColor: item.colorCode,
                    borderColor: p.border,
                  }}
                />
              ) : null}
              <Text
                className="text-[14px]"
                style={{ color: p.mutedForeground }}
              >
                {item.colorName}
              </Text>
            </View>
          </View>
          <View className="shrink-0 items-end">
            <Text
              className="text-[14px] font-bold tabular-nums"
              style={{ color: item.totalWt < 0 ? p.destructive : p.foreground }}
            >
              {fmtWt(item.totalWt)}{" "}
              <Text
                className="text-xs font-medium"
                style={{ color: p.mutedForeground }}
              >
                kg
              </Text>
            </Text>
            {item.totalWt < 0 ? (
              <View className="mt-0.5 flex-row items-center justify-end gap-1">
                <Feather
                  name="alert-triangle"
                  size={12}
                  color={p.destructive}
                />
                <Text className="text-xs" style={{ color: p.destructive }}>
                  Negative
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <Animated.View style={chevronStyle}>
          <Feather name="chevron-down" size={16} color={p.mutedForeground} />
        </Animated.View>
      </Pressable>
      <Animated.View
        className="overflow-hidden"
        style={bodyStyle}
        pointerEvents={open ? "auto" : "none"}
      >
        <View onLayout={(e) => setBodyHeight(e.nativeEvent.layout.height)}>
          <View className="px-4 pb-4">
            <View className="border-t pt-3" style={{ borderColor: p.border }}>
              <View className="flex-row flex-wrap items-center gap-1.5">
                <Badge
                  label={
                    item.lotNo === "Unlabelled"
                      ? "Unlabelled"
                      : `Lot: ${item.lotNo}`
                  }
                  tone="secondary"
                />
                <Text className="text-xs" style={{ color: p.mutedForeground }}>
                  {item.movements}{" "}
                  {item.movements === 1 ? "movement" : "movements"}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

export default function StockRoute() {
  const params = useLocalSearchParams<{ kind?: string; type?: string }>();
  const status = useAuth((s) => s.status);
  const workspaceId = useAuth((s) => s.workspace?.id ?? "");
  const can = usePermission();
  const router = useRouter();
  const allowed = can("view_stock");

  // Same contract as web ProtectedRoute: guest → sign-in, permission miss →
  // home (the "/" gate routes packer-only accounts to packing).
  useEffect(() => {
    if (status === "guest") router.replace("/auth");
    else if (status === "authed" && !allowed) router.replace("/");
  }, [status, allowed, router]);

  if (status !== "authed" || !allowed) return null;
  return (
    <StockPage
      stockType={
        params.kind === "raw" || params.type === "raw" ? "raw" : "dyed"
      }
      workspaceId={workspaceId}
    />
  );
}

function StockPage({
  stockType,
  workspaceId,
}: {
  stockType: StockType;
  workspaceId: string;
}) {
  const [items, setItems] = useState<StockGroup[]>(
    () => stockCache[workspaceId]?.[stockType] ?? [],
  );
  const [loading, setLoading] = useState(
    () => !stockCache[workspaceId]?.[stockType],
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  // One morph row open at a time (web MorphGroup); the key includes the row
  // index, exactly like the web panel ids.
  const [openKey, setOpenKey] = useState<string | null>(null);
  // Live type mirror — the callback's captured stockType can't guard against
  // itself (it would always compare equal).
  const stockTypeRef = useRef(stockType);
  stockTypeRef.current = stockType;
  const workspaceRef = useRef(workspaceId);
  workspaceRef.current = workspaceId;
  const loadSeq = useRef(0);
  const p = usePalette();

  const load = useCallback(async () => {
    const type = stockType;
    const requestedWorkspace = workspaceId;
    const seq = ++loadSeq.current;
    if (!requestedWorkspace) return;
    if (!stockCache[workspaceId]?.[type]) {
      setLoading(true);
    }
    setLoadError(null);
    try {
      const res = await api<{ items: StockGroup[] }>(`/stock?type=${type}`);
      if (
        seq !== loadSeq.current ||
        requestedWorkspace !== workspaceRef.current ||
        type !== stockTypeRef.current
      )
        return;
      (stockCache[workspaceId] ??= { raw: null, dyed: null })[type] = res.items;
      setItems(res.items);
    } catch (err) {
      if (
        seq === loadSeq.current &&
        requestedWorkspace === workspaceRef.current &&
        type === stockTypeRef.current &&
        !stockCache[requestedWorkspace]?.[type]
      ) {
        setItems([]);
        setLoadError(friendlyError(err));
      }
    } finally {
      if (
        seq === loadSeq.current &&
        requestedWorkspace === workspaceRef.current &&
        type === stockTypeRef.current
      )
        setLoading(false);
    }
  }, [stockType, workspaceId]);

  useEffect(() => {
    const cached = stockCache[workspaceId]?.[stockType];
    setItems(cached ?? []);
    setLoading(!cached);
    setLoadError(null);
    void load();
  }, [load, stockType, workspaceId]);

  // Other devices' writes arrive live; this device's writes refresh through
  // its own store paths.
  useRealtimeEvent(["stock", "challans", "raw-material", "packing"], load);

  const filtered = useMemo(
    () =>
      items.filter(
        (i) =>
          !q ||
          i.denierName?.toLowerCase().includes(q.toLowerCase()) ||
          i.colorName?.toLowerCase().includes(q.toLowerCase()),
      ),
    [items, q],
  );

  const totalKg = filtered.reduce((s, i) => s + i.totalWt, 0);
  const icon: IconValue = stockType === "raw" ? Warehouse : "layers";

  return (
    <Screen
      eyebrow={stockType === "raw" ? "Grey yarn" : "Dyed yarn"}
      title={stockType === "raw" ? "Raw stock" : "Dyed stock"}
      action={
        <View
          className="flex-row items-center justify-between gap-6 rounded-lg border p-4"
          style={{ backgroundColor: p.card, borderColor: p.border }}
        >
          <View className="min-w-0 flex-1">
            <Text
              className="text-[11px] font-semibold uppercase tracking-[0.06em]"
              style={{ color: p.mutedForeground }}
            >
              Total
            </Text>
            <Text
              className="mt-1 text-[28px] font-bold tracking-tight tabular-nums"
              style={{ color: totalKg < 0 ? p.destructive : p.foreground }}
            >
              {fmtWt(totalKg)}{" "}
              <Text
                className="text-[14px] font-semibold"
                style={{ color: p.mutedForeground }}
              >
                kg
              </Text>
            </Text>
          </View>
          <View
            className="h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: p.muted }}
          >
            <AppIcon name={icon} size={20} color={p.mutedForeground} />
          </View>
        </View>
      }
      banner={<SyncStrip />}
    >
      <View className="flex-1 pb-6">
        {/* Filter bar — one card holding search (design.md §3) */}
        <View
          className="mx-4 rounded-lg border p-3"
          style={{ backgroundColor: p.card, borderColor: p.border }}
        >
          <View>
            <Feather
              name="search"
              size={16}
              color={p.mutedForeground}
              style={{ position: "absolute", left: 12, top: 14 }}
            />
            <Input
              placeholder="Search by denier or colour…"
              accessibilityLabel="Search stock"
              value={q}
              onChangeText={setQ}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={[
                { paddingLeft: 38, paddingRight: 40 },
                {
                  backgroundColor: p.card,
                  borderColor: p.input,
                  color: p.foreground,
                },
              ]}
            />
            {q ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setQ("")}
                className="absolute right-1 top-1 h-11 w-11 items-center justify-center rounded-full"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Feather name="x" size={14} color={p.mutedForeground} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Mobile count line */}
        <View className="mt-2 px-4">
          <Text
            className="text-xs tabular-nums"
            style={{ color: p.mutedForeground }}
          >
            {loading
              ? "Refreshing…"
              : countLabel(filtered.length, "group", "groups")}
          </Text>
        </View>

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
              className="text-[11px] font-semibold uppercase tracking-[0.06em]"
              style={{ color: p.mutedForeground }}
            >
              Lots •{" "}
              {filtered.length > 0 ? `${filtered.length} shown` : "stock"}
            </Text>
            <Text
              className="text-[11px] tabular-nums"
              style={{ color: p.mutedForeground }}
            >
              {loading ? "Refreshing…" : `${fmtWt(totalKg)} kg`}
            </Text>
          </View>

          {loading ? (
            <View className="gap-3 p-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <View
                  key={i}
                  className="gap-3 rounded-lg border p-4"
                  style={{ borderColor: p.border }}
                >
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-5 w-24 rounded-sm" />
                </View>
              ))}
            </View>
          ) : loadError ? (
            <EmptyState
              icon={icon}
              title="Couldn't load stock"
              message={loadError}
              action={
                <Button
                  label="Retry"
                  variant="outline"
                  onPress={() => void load()}
                />
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={icon}
              title="No stock yet"
              message={
                stockType === "raw"
                  ? "Raw material entries will populate the grey yarn stock."
                  : "Job-work returns will populate the dyed yarn stock."
              }
            />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item, idx) => rowKey(item, idx)}
              extraData={openKey}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 12, gap: 12 }}
              renderItem={({ item, index }) => {
                const key = rowKey(item, index);
                return (
                  <StockPanel
                    item={item}
                    open={openKey === key}
                    onToggle={() =>
                      setOpenKey((prev) => (prev === key ? null : key))
                    }
                  />
                );
              }}
            />
          )}
        </View>
      </View>
    </Screen>
  );
}
