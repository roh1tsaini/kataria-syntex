/**
 * Stock — the Android port of apps/app's StockPage (mobile-cards variant).
 * One route serves both kinds via the "kind" param ("raw" | "dyed", default
 * dyed — web: /stock/raw and /stock/dyed). Same API call, same workspace-
 * keyed module cache registered with registerDataCache (stale-while-
 * revalidate; wiped on logout/401), search, totals, and view_stock gate
 * (web: ProtectedRoute requirePermission="view_stock").
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
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
import { Badge, Button, Input, Screen, Skeleton } from "@/ui/kit";

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

function StockCard({ item }: { item: StockGroup }) {
  const p = usePalette();
  return (
    <View
      className="rounded-lg border p-4"
      style={{ borderColor: p.border, backgroundColor: p.card }}
    >
      <View className="flex-row items-start justify-between gap-2">
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
            <Text className="text-[14px]" style={{ color: p.mutedForeground }}>
              {item.colorName}
            </Text>
          </View>
          <View className="mt-1.5 flex-row flex-wrap items-center gap-1.5">
            <Badge
              label={
                item.lotNo === "Unlabelled"
                  ? "Unlabelled"
                  : `Lot: ${item.lotNo}`
              }
            />
            <Text className="text-xs" style={{ color: p.mutedForeground }}>
              {item.movements} {item.movements === 1 ? "movement" : "movements"}
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
              <Feather name="alert-triangle" size={11} color={p.destructive} />
              <Text className="text-xs" style={{ color: p.destructive }}>
                Negative
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
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
  const icon = stockType === "raw" ? "box" : "layers";

  const header = (
    <View className="px-4">
      <View
        className="flex-row items-center justify-between gap-4 rounded-xl border p-4"
        style={{ backgroundColor: p.card, borderColor: p.border }}
      >
        <View className="min-w-0 flex-1">
          <Text
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: p.mutedForeground }}
          >
            Total
          </Text>
          <Text
            className="mt-1 text-[22px] font-bold tabular-nums"
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
          <Feather name={icon} size={18} color={p.mutedForeground} />
        </View>
      </View>

      <View className="mt-4">
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
        <Text
          className="mt-2 text-xs tabular-nums"
          style={{ color: p.mutedForeground }}
        >
          {loading
            ? "Refreshing…"
            : countLabel(filtered.length, "group", "groups")}
        </Text>
      </View>

      <View
        className="mt-3 flex-row items-center justify-between rounded-t-xl border-b px-4 py-2.5"
        style={{
          borderColor: p.border,
          backgroundColor: p.muted,
          borderBottomWidth: 1,
        }}
      >
        <Text
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: p.mutedForeground }}
        >
          {stockType === "raw" ? "Grey yarn lots" : "Dyed yarn lots"}
        </Text>
        <Text
          className="text-[11px] tabular-nums"
          style={{ color: p.mutedForeground }}
        >
          {loading
            ? "Refreshing…"
            : filtered.length > 0
              ? `${filtered.length} shown`
              : "stock"}
        </Text>
      </View>
    </View>
  );

  const footer = filtered.length > 0 ? <View className="h-4" /> : null;

  return (
    <Screen
      title={stockType === "raw" ? "Raw stock" : "Dyed stock"}
      subtitle={stockType === "raw" ? "Grey yarn" : "Dyed yarn"}
    >
      <FlatList
        data={loading || loadError || filtered.length === 0 ? [] : filtered}
        keyExtractor={(item, idx) =>
          `${item.denierId ?? "x"}-${item.colorId ?? "x"}-${item.lotNo}-${idx}`
        }
        renderItem={({ item }) => (
          <View className="px-4 pt-3">
            <StockCard item={item} />
          </View>
        )}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={
          loading ? (
            <View className="gap-3 p-4">
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
            <View className="items-center gap-4 px-4 py-10">
              <Feather name={icon} size={24} color={p.mutedForeground} />
              <View className="items-center gap-1">
                <Text
                  className="text-[15px] font-semibold"
                  style={{ color: p.foreground }}
                >
                  Couldn't load stock
                </Text>
                <Text
                  className="text-center text-[13px]"
                  style={{ color: p.mutedForeground }}
                >
                  {loadError}
                </Text>
              </View>
              <Button
                label="Retry"
                variant="secondary"
                onPress={() => void load()}
              />
            </View>
          ) : (
            <View className="items-center gap-1 px-4 py-10">
              <Feather name={icon} size={24} color={p.mutedForeground} />
              <Text
                className="text-[15px] font-semibold"
                style={{ color: p.foreground }}
              >
                No stock yet
              </Text>
              <Text
                className="text-center text-[13px]"
                style={{ color: p.mutedForeground }}
              >
                {stockType === "raw"
                  ? "Raw material entries will populate the grey yarn stock."
                  : "Job-work returns will populate the dyed yarn stock."}
              </Text>
            </View>
          )
        }
        contentContainerClassName="pb-8"
      />
    </Screen>
  );
}
