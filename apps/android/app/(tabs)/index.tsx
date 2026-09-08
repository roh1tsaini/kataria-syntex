/**
 * Dashboard tab — the phone port of apps/app's Dashboard page: KPI cards
 * with period deltas (This FY / Last 30 days / All time), job-work volume
 * bars, dispatch-by-customer donut, recent challans, quick links and the
 * flow-stage cards from /reports/dashboard. Same stores and math as the web
 * (useChallans().summary + summaryCache read-through).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useAuth,
  useChallans,
  usePermission,
  registerDataCache,
  api,
  toastError,
  friendlyError,
  type Challan,
  type RecentChallan,
} from "@kataria-syntex/app-core";
import { usePalette, type Palette } from "@/theme";
import { Button, Card, EmptyState, Screen, Skeleton } from "@/ui/kit";
import { SyncBanner, SyncSheet } from "@/ui/sync";
import { fmtBoxes, fmtWt } from "@/lib/format";
import {
  aggregate,
  inWindow,
  pctDelta,
  prevFilter,
  revenueBuckets,
  type Period,
} from "@/lib/dashboard-math";

type FeatherGlyph = keyof typeof Feather.glyphMap;

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: "fy", label: "This FY" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

function recentFrom(
  list: Challan[],
  type: RecentChallan["type"],
): RecentChallan[] {
  return list.map((c) => ({
    id: c.id,
    number: c.challanNumber,
    type,
    date: c.date,
    createdAt: c.createdAt,
    party:
      type === "sales" ? (c.customerName ?? "—") : (c.jobWorkerName ?? "—"),
    boxes: c.totalBoxes,
    netWt: c.totalNetWt,
  }));
}

function TypeChip({ type }: { type: RecentChallan["type"] }) {
  const p = usePalette();
  const sales = type === "sales";
  return (
    <View
      className="self-start rounded-sm px-1.5 py-0.5"
      style={{ backgroundColor: sales ? `${p.primary}1a` : `${p.warning}1a` }}
    >
      <Text
        className="text-[10px] font-bold uppercase tracking-wider"
        style={{ color: sales ? p.primary : p.warning }}
      >
        {sales ? "Sales" : "Job work"}
      </Text>
    </View>
  );
}

function StatCard({
  icon,
  label,
  value,
  format,
  sub,
  delta,
  loading,
}: {
  icon: FeatherGlyph;
  label: string;
  value: number;
  format?: (n: number) => string;
  sub?: string;
  delta?: number | null;
  loading?: boolean;
}) {
  const p = usePalette();
  return (
    <Card className="flex-1">
      <View className="flex-row items-center justify-between">
        <View
          className="h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: p.muted }}
        >
          <Feather name={icon} size={18} color={p.mutedForeground} />
        </View>
        {delta != null ? (
          <View
            className="rounded-sm px-1.5 py-0.5"
            style={{
              backgroundColor:
                delta >= 0 ? `${p.success}1a` : `${p.destructive}1a`,
            }}
          >
            <Text
              className="text-[11px] font-semibold"
              style={{ color: delta >= 0 ? p.success : p.destructive }}
            >
              {delta >= 0 ? "+" : ""}
              {delta.toFixed(1)}%
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        className="mt-3 text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: p.mutedForeground }}
      >
        {label}
      </Text>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <Text
          className="mt-1 text-[26px] font-bold leading-8"
          style={{ color: p.foreground }}
        >
          {format ? format(value) : value.toLocaleString("en-IN")}
        </Text>
      )}
      {sub ? (
        <Text className="mt-1 text-xs" style={{ color: p.mutedForeground }}>
          {sub}
        </Text>
      ) : null}
    </Card>
  );
}

function VolumeChart({
  buckets,
}: {
  buckets: ReturnType<typeof revenueBuckets>;
}) {
  const p = usePalette();
  const max = Math.max(...buckets.map((b) => b.netWt), 1);
  const total = buckets.reduce((s, b) => s + b.netWt, 0);
  const hasData = buckets.some((b) => b.netWt > 0);
  return (
    <View>
      <View className="flex-row flex-wrap items-baseline gap-x-3">
        <Text className="text-xl font-bold" style={{ color: p.foreground }}>
          {fmtWt(total)}{" "}
          <Text
            className="text-sm font-medium"
            style={{ color: p.mutedForeground }}
          >
            kg
          </Text>
        </Text>
        <Text className="text-xs" style={{ color: p.mutedForeground }}>
          {fmtWt(total / Math.max(buckets.length, 1))} kg avg per period
        </Text>
      </View>
      {hasData ? (
        <>
          <View
            className="mt-4 h-40 flex-row items-end"
            style={{ gap: 4 }}
            accessibilityRole="image"
            accessibilityLabel="Job-work volume over time bar chart"
          >
            {buckets.map((b) => (
              <View
                key={b.key}
                className="flex-1 rounded-t-md"
                style={{
                  height: `${Math.max(b.netWt / max, 0.02) * 100}%`,
                  backgroundColor: `${p.primary}b3`,
                }}
              />
            ))}
          </View>
          <View className="mt-2 flex-row" style={{ gap: 4 }}>
            {buckets.map((b, i) => (
              <Text
                key={i}
                className="flex-1 text-center text-[9px] font-semibold"
                style={{ color: p.mutedForeground }}
                numberOfLines={1}
              >
                {b.label}
              </Text>
            ))}
          </View>
        </>
      ) : (
        <EmptyState
          title="No job work in this period"
          message="Outward challans will show up here."
        />
      )}
    </View>
  );
}

const DONUT_COLORS = (p: Palette) => [
  p.primary,
  p.success,
  p.warning,
  p.destructive,
  p.accentInk,
  p.mutedForeground,
];

function CustomerDonut({ list }: { list: Challan[] }) {
  const p = usePalette();
  const router = useRouter();
  const total = list.reduce((s, c) => s + c.totalNetWt, 0);
  if (total <= 0) {
    return (
      <EmptyState
        title="No sales in this period"
        message="Sales challans will show up here."
      />
    );
  }
  const byName = new Map<string, number>();
  for (const c of list) {
    const name = c.customerName ?? "Unknown";
    byName.set(name, (byName.get(name) ?? 0) + c.totalNetWt);
  }
  const top = [...byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topTotal = top.reduce((s, [, v]) => s + v, 0);
  const slices =
    total - topTotal > 0
      ? ([...top, ["Other", total - topTotal]] as const)
      : top;

  const colors = DONUT_COLORS(p);
  const size = 144;
  const radius = 56;
  const stroke = 20;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const isFullCircle = slices.length === 1;
  let acc = 0;

  return (
    <View className="flex-row flex-wrap items-center" style={{ gap: 20 }}>
      <View>
        <Svg width={size} height={size}>
          {slices.map(([name, v], i) => {
            const len = (v / total) * circumference;
            const offset = acc;
            acc += len;
            return (
              <Circle
                key={name}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={colors[i % colors.length]}
                strokeWidth={stroke}
                strokeDasharray={
                  isFullCircle
                    ? `${circumference} 0`
                    : `${len} ${circumference - len}`
                }
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            );
          })}
        </Svg>
        <View
          className="absolute items-center justify-center rounded-full"
          style={{
            top: stroke + 8,
            bottom: stroke + 8,
            left: stroke + 8,
            right: stroke + 8,
            backgroundColor: p.card,
          }}
        >
          <Text
            className="text-base font-semibold"
            style={{ color: p.foreground }}
          >
            {fmtWt(total)}
          </Text>
          <Text
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: p.mutedForeground }}
          >
            kg Total
          </Text>
        </View>
      </View>
      <View className="min-w-[180px] flex-1 gap-2">
        {slices.map(([name, v], i) => (
          <View key={name} className="flex-row items-center" style={{ gap: 8 }}>
            <View
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: colors[i % colors.length] }}
            />
            <Text
              className="flex-1 text-sm"
              style={{ color: p.foreground }}
              numberOfLines={1}
            >
              {name}
            </Text>
            <Text
              className="w-10 text-right text-sm font-semibold"
              style={{ color: p.foreground }}
            >
              {((v / total) * 100).toFixed(0)}%
            </Text>
            <Text
              className="w-20 text-right text-sm"
              style={{ color: p.mutedForeground }}
            >
              {fmtWt(v)} kg
            </Text>
          </View>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/masters")}
          className="mt-1 flex-row items-center self-start"
          style={{ gap: 4 }}
        >
          <Text className="text-xs font-semibold" style={{ color: p.primary }}>
            View customers
          </Text>
          <Feather name="arrow-up-right" size={12} color={p.primary} />
        </Pressable>
      </View>
    </View>
  );
}

type FlowCardData = {
  label: string;
  value: number;
  unit: string;
  link: string;
};

// Keyed by workspace id so one account's cards never leak into another's.
// Registered so account resets (logout/401) wipe it — see app-core data-caches.
let cachedFlowCards: Record<string, FlowCardData[]> = {};
registerDataCache(() => {
  cachedFlowCards = {};
});

const FLOW_ROUTES: Record<string, string> = {
  Sent: "/(tabs)/outward",
  Returned: "/returns",
  "In Stock Raw": "/stock?kind=raw",
  "In Stock Dyed": "/stock?kind=dyed",
  Sold: "/(tabs)/challans",
};

const FLOW_ICONS: Record<string, FeatherGlyph> = {
  Sent: "send",
  Returned: "corner-down-left",
  "In Stock Raw": "database",
  "In Stock Dyed": "layers",
  Sold: "file-text",
};

function FlowCards({ wsId }: { wsId: string | undefined }) {
  const p = usePalette();
  const router = useRouter();
  const cacheKey = wsId ?? "";
  const [cards, setCards] = useState<FlowCardData[]>(
    () => cachedFlowCards[cacheKey] ?? [],
  );

  useEffect(() => {
    if (!cacheKey) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await api<{ cards: FlowCardData[] }>("/reports/dashboard");
        cachedFlowCards[cacheKey] = res.cards;
        if (!cancelled) setCards(res.cards);
      } catch {
        // Non-critical — the dashboard works without it (no view_reports).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cacheKey]);

  if (cards.length === 0) return null;

  return (
    <View className="flex-row flex-wrap" style={{ gap: 10 }}>
      {cards.map((card, idx) => {
        const lastOdd = idx === cards.length - 1 && cards.length % 2 === 1;
        return (
          <Pressable
            key={card.label}
            accessibilityRole="button"
            onPress={() => {
              const route = FLOW_ROUTES[card.label] ?? "/reports";
              router.push(route);
            }}
            className="rounded-xl border p-3"
            style={({ pressed }) => ({
              backgroundColor: p.card,
              borderColor: p.border,
              flexGrow: 1,
              flexBasis: lastOdd ? "100%" : "46%",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <View
                className="h-9 w-9 items-center justify-center rounded-lg"
                style={{ backgroundColor: p.muted }}
              >
                <Feather
                  name={FLOW_ICONS[card.label] ?? "package"}
                  size={16}
                  color={p.mutedForeground}
                />
              </View>
              <Text
                className="flex-1 text-xs"
                style={{ color: p.mutedForeground }}
                numberOfLines={1}
              >
                {card.label}
              </Text>
            </View>
            <View className="mt-2 flex-row items-baseline" style={{ gap: 4 }}>
              <Text
                className="text-base font-semibold"
                style={{ color: card.value < 0 ? p.destructive : p.foreground }}
              >
                {card.value.toFixed(3)}
              </Text>
              <Text className="text-xs" style={{ color: p.mutedForeground }}>
                {card.unit}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const QUICK_LINKS: Array<{
  to: string;
  icon: FeatherGlyph;
  title: string;
  desc: string;
}> = [
  {
    to: "/members",
    icon: "users",
    title: "Members",
    desc: "Invite and manage your team",
  },
  {
    to: "/masters",
    icon: "book-open",
    title: "Masters",
    desc: "Customers, job workers, deniers, colors",
  },
  {
    to: "/devices",
    icon: "smartphone",
    title: "Devices",
    desc: "Pair new devices and revoke old ones",
  },
  {
    to: "/settings",
    icon: "settings",
    title: "Settings",
    desc: "Company details and challan numbering",
  },
];

export default function DashboardTab() {
  const user = useAuth((s) => s.user);
  const workspace = useAuth((s) => s.workspace);
  const company = useAuth((s) => s.company);
  const currentFy = useAuth((s) => s.currentFy);
  const summary = useChallans((s) => s.summary);
  const can = usePermission();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const [syncOpen, setSyncOpen] = useState(false);

  const cacheKey = `${workspace?.id ?? ""}:${currentFy?.label ?? ""}`;

  const [sales, setSales] = useState<Challan[]>([]);
  const [outward, setOutward] = useState<Challan[]>([]);
  const [period, setPeriod] = useState<Period>("fy");
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!currentFy || !cacheKey) {
        setLoading(false);
        return;
      }
      let cancelled = false;
      // Cache read-through: instant paint from a previous load, then refresh.
      const instant = useChallans.getState().summaryCache[cacheKey];
      if (instant) {
        setSales(instant.sales);
        setOutward(instant.outward);
        setLoading(false);
      } else {
        setLoading(true);
      }
      // Scoped to the current financial year — without it the server returns
      // every challan ever created and the dashboard filters in JS.
      summary(currentFy.label, workspace?.id)
        .then((res) => {
          if (cancelled) return;
          setSales(res.sales);
          setOutward(res.outward);
        })
        .catch((err) => {
          if (!cancelled)
            toastError("Could not load dashboard", friendlyError(err));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [currentFy, summary, cacheKey, workspace?.id]),
  );

  const stats = useMemo(() => {
    const fy = currentFy?.label ?? "";
    const currentSales = sales.filter((c) => inWindow(c, period, fy));
    const currentOutward = outward.filter((c) => inWindow(c, period, fy));
    const prev = prevFilter(period, fy);
    const old = aggregate([...sales.filter(prev), ...outward.filter(prev)]);
    const cur = aggregate([...currentSales, ...currentOutward]);
    return {
      count: cur.count,
      salesCount: currentSales.length,
      outwardCount: currentOutward.length,
      outwardDelta: pctDelta(
        currentOutward.length,
        aggregate(outward.filter(prev)).count,
      ),
      totalBoxes: cur.boxes,
      totalNetWt: cur.netWt,
      delta: {
        count: pctDelta(cur.count, old.count),
        boxes: pctDelta(cur.boxes, old.boxes),
        netWt: pctDelta(cur.netWt, old.netWt),
      },
    };
  }, [sales, outward, period, currentFy]);

  const recent = useMemo(() => {
    const fy = currentFy?.label ?? "";
    const all = [
      ...recentFrom(
        sales.filter((c) => inWindow(c, period, fy)),
        "sales",
      ),
      ...recentFrom(
        outward.filter((c) => inWindow(c, period, fy)),
        "outward",
      ),
    ];
    return all
      .sort(
        (a, b) =>
          // Newest first; createdAt breaks date ties (number strings sort
          // wrong: "…-9" > "…-10").
          b.date.localeCompare(a.date) ||
          b.createdAt.localeCompare(a.createdAt),
      )
      .slice(0, 6);
  }, [sales, outward, period, currentFy]);

  const volumeBuckets = useMemo(
    () => revenueBuckets(outward, period, currentFy?.label ?? ""),
    [outward, period, currentFy],
  );

  const salesWindow = useMemo(() => {
    const fy = currentFy?.label ?? "";
    return sales.filter((c) => inWindow(c, period, fy));
  }, [sales, period, currentFy]);

  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const canCreate = can("create_challan");

  return (
    <View
      className="flex-1"
      style={{ paddingTop: insets.top, backgroundColor: p.background }}
    >
      <SyncBanner onOpen={() => setSyncOpen(true)} />
      <Screen
        title="Overview"
        subtitle={`${company?.name ?? workspace?.name ?? "—"} · Financial year ${currentFy?.label ?? "—"}`}
      >
        <ScrollView
          contentContainerStyle={{
            paddingBottom: 48,
            gap: 16,
            paddingHorizontal: 16,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: p.mutedForeground }}
          >
            {todayLabel}
          </Text>

          {canCreate ? (
            <View className="flex-row" style={{ gap: 10 }}>
              <View className="flex-1">
                <Button
                  label="New sales challan"
                  onPress={() =>
                    router.push({
                      pathname: "/challan-editor",
                      params: { kind: "sales" },
                    })
                  }
                />
              </View>
              <View className="flex-1">
                <Button
                  label="New job-work"
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: "/challan-editor",
                      params: { kind: "outward" },
                    })
                  }
                />
              </View>
            </View>
          ) : null}

          <FlowCards wsId={workspace?.id} />

          <View
            className="flex-row self-start rounded-lg p-1"
            style={{ backgroundColor: p.muted, gap: 2 }}
          >
            {PERIODS.map((option) => {
              const active = period === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  onPress={() => setPeriod(option.value)}
                  className="rounded-md px-3"
                  style={({ pressed }) => ({
                    minHeight: 36,
                    justifyContent: "center",
                    backgroundColor: active ? p.card : "transparent",
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text
                    className="text-[13px] font-semibold"
                    style={{ color: active ? p.foreground : p.mutedForeground }}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View className="flex-row flex-wrap" style={{ gap: 10 }}>
            <StatCard
              icon="file-text"
              label="Challans issued"
              value={stats.count}
              delta={stats.delta.count}
              sub={`${stats.salesCount} sales · ${stats.outwardCount} job work`}
              loading={loading}
            />
            <StatCard
              icon="box"
              label="Total packages"
              value={stats.totalBoxes}
              delta={stats.delta.boxes}
              format={fmtBoxes}
              sub="Boxes & sacks"
              loading={loading}
            />
          </View>
          <View className="flex-row flex-wrap" style={{ gap: 10 }}>
            <StatCard
              icon="anchor"
              label="Net weight"
              value={stats.totalNetWt}
              delta={stats.delta.netWt}
              format={fmtWt}
              sub="Kilograms"
              loading={loading}
            />
            <StatCard
              icon="send"
              label="Job-work sendings"
              value={stats.outwardCount}
              delta={stats.outwardDelta}
              sub="Challans sent for dyeing"
              loading={loading}
            />
          </View>

          <Card>
            <View className="flex-row items-center justify-between">
              <Text
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: p.mutedForeground }}
              >
                Job-work volume over time
              </Text>
              <Text className="text-xs" style={{ color: p.mutedForeground }}>
                Kilograms
              </Text>
            </View>
            <View className="mt-3">
              {loading ? (
                <Skeleton className="h-52 w-full rounded-md" />
              ) : (
                <VolumeChart buckets={volumeBuckets} />
              )}
            </View>
          </Card>

          <Card>
            <View className="flex-row items-center justify-between">
              <Text
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: p.mutedForeground }}
              >
                Dispatch by customer
              </Text>
            </View>
            <View className="mt-3">
              {loading ? (
                <Skeleton className="h-52 w-full rounded-md" />
              ) : (
                <CustomerDonut list={salesWindow} />
              )}
            </View>
          </Card>

          <Card>
            <View className="flex-row items-center justify-between">
              <Text
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: p.mutedForeground }}
              >
                Recent challans
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/(tabs)/challans")}
                className="flex-row items-center"
                style={{ gap: 4 }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: p.primary }}
                >
                  View all
                </Text>
                <Feather name="arrow-up-right" size={12} color={p.primary} />
              </Pressable>
            </View>
            <View className="mt-1">
              {loading ? (
                <View className="gap-3 py-3">
                  {[0, 1, 2, 3].map((i) => (
                    <View
                      key={i}
                      className="flex-row items-center"
                      style={{ gap: 12 }}
                    >
                      <Skeleton className="h-10 w-10 rounded-md" />
                      <View className="flex-1 gap-2">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/3" />
                      </View>
                      <Skeleton className="h-4 w-16" />
                    </View>
                  ))}
                </View>
              ) : recent.length === 0 ? (
                <EmptyState
                  title={`No challans yet for FY ${currentFy?.label ?? ""}`}
                  message="Create your first challan to see it here."
                />
              ) : (
                recent.map((r, i) => (
                  <Pressable
                    key={`${r.type}-${r.id}`}
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: "/challan-detail",
                        params: { id: r.id, kind: r.type },
                      })
                    }
                    className="flex-row items-center py-3"
                    style={({ pressed }) => ({
                      gap: 12,
                      opacity: pressed ? 0.7 : 1,
                      borderBottomWidth: i < recent.length - 1 ? 1 : 0,
                      borderBottomColor: p.border,
                    })}
                  >
                    <View
                      className="h-7 w-7 items-center justify-center rounded-md"
                      style={{
                        backgroundColor:
                          r.type === "sales" ? p.accentSoft : `${p.warning}1a`,
                      }}
                    >
                      <Feather
                        name={r.type === "sales" ? "file-text" : "send"}
                        size={14}
                        color={r.type === "sales" ? p.accentInk : p.warning}
                      />
                    </View>
                    <View className="min-w-0 flex-1">
                      <View
                        className="flex-row items-center"
                        style={{ gap: 8 }}
                      >
                        <Text
                          className="text-[13px] font-bold"
                          style={{ color: p.primary, fontFamily: "monospace" }}
                          numberOfLines={1}
                        >
                          {r.number}
                        </Text>
                        <TypeChip type={r.type} />
                      </View>
                      <Text
                        className="mt-0.5 text-xs"
                        style={{ color: p.mutedForeground }}
                        numberOfLines={1}
                      >
                        {r.party} · {r.date}
                      </Text>
                    </View>
                    <View className="shrink-0 items-end">
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: p.foreground }}
                      >
                        {fmtBoxes(r.boxes)}{" "}
                        <Text
                          className="text-xs font-normal"
                          style={{ color: p.mutedForeground }}
                        >
                          {r.type === "sales" ? "boxes" : "sacks"}
                        </Text>
                      </Text>
                      <Text
                        className="text-xs"
                        style={{ color: p.mutedForeground }}
                      >
                        {fmtWt(r.netWt)} kg
                      </Text>
                    </View>
                  </Pressable>
                ))
              )}
            </View>
          </Card>

          <Card>
            <Text
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: p.mutedForeground }}
            >
              Quick links
            </Text>
            <View className="mt-2">
              {QUICK_LINKS.map((link, i) => (
                <Pressable
                  key={link.to}
                  accessibilityRole="button"
                  onPress={() => router.push(link.to)}
                  className="flex-row items-center rounded-md px-2 py-3"
                  style={({ pressed }) => ({
                    gap: 12,
                    opacity: pressed ? 0.7 : 1,
                    borderBottomWidth: i < QUICK_LINKS.length - 1 ? 1 : 0,
                    borderBottomColor: p.border,
                  })}
                >
                  <View
                    className="h-7 w-7 items-center justify-center rounded-md"
                    style={{ backgroundColor: p.accentSoft }}
                  >
                    <Feather name={link.icon} size={14} color={p.accentInk} />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: p.foreground }}
                    >
                      {link.title}
                    </Text>
                    <Text
                      className="text-xs"
                      style={{ color: p.mutedForeground }}
                      numberOfLines={1}
                    >
                      {link.desc}
                    </Text>
                  </View>
                  <Feather
                    name="arrow-up-right"
                    size={14}
                    color={p.mutedForeground}
                  />
                </Pressable>
              ))}
            </View>
          </Card>
        </ScrollView>
      </Screen>
      <SyncSheet open={syncOpen} onOpenChange={setSyncOpen} />
    </View>
  );
}
