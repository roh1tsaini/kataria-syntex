/**
 * Dashboard tab — the phone port of apps/app's Dashboard page: KPI cards
 * with period deltas (This FY / Last 30 days / All time), job-work volume
 * bars, dispatch-by-customer donut, recent challans, quick links and the
 * flow-stage cards from /reports/dashboard. Same stores and math as the web
 * (useChallans().summary + summaryCache read-through).
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { useRouter, useFocusEffect } from "expo-router";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import {
  useAuth,
  useChallans,
  usePermission,
  registerDataCache,
  api,
  toastError,
  friendlyError,
  useRealtimeEvent,
  type Challan,
  type Permission,
  type RecentChallan,
} from "@kataria-syntex/app-core";
import { usePalette, withAlpha, type Palette } from "@/theme";
import { useReduceMotion } from "@/lib/motion";
import { Button, Card, EmptyState, Screen, Skeleton } from "@/ui/kit";
import {
  AppIcon,
  Factory,
  PackageOpen,
  Scale,
  Warehouse,
  type IconValue,
} from "@/ui/feather";
import { CountUp } from "@/ui/count-up";
import { SyncStrip } from "@/ui/sync";
import { fmtBoxes, fmtWt } from "@/lib/format";
import {
  aggregate,
  inWindow,
  pctDelta,
  prevFilter,
  revenueBuckets,
  type Period,
} from "@/lib/dashboard-math";

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: "fy", label: "This FY" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

/** Web EASE_OUT — dashboard entrance tweens mirror motion/react. */
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

/** Section entrance: the web Reveal/StaggerItem fade + 6px rise, 200ms. */
function FadeUp({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
}) {
  const reduce = useReduceMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = reduce
      ? withTiming(1, { duration: 0 })
      : withDelay(delay, withTiming(1, { duration: 200, easing: EASE_OUT }));
  }, [delay, progress, reduce]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 6 }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Card header band — web's bg-muted/35 strip with a hairline bottom edge. */
function CardSectionHeader({
  label,
  right,
}: {
  label: string;
  right?: ReactNode;
}) {
  const p = usePalette();
  return (
    <View
      className="flex-row items-center justify-between px-4 py-3"
      style={{
        borderBottomWidth: 1,
        borderBottomColor: withAlpha(p.border, 0.7),
        backgroundColor: withAlpha(p.muted, 0.35),
      }}
    >
      <Text
        className="text-[11px] font-semibold uppercase"
        style={{ color: p.mutedForeground, letterSpacing: 0.66 }}
      >
        {label}
      </Text>
      {right}
    </View>
  );
}

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
  const tone = sales ? p.primary : p.warning;
  return (
    <View
      className="min-h-[20px] flex-row items-center self-start rounded-sm border px-1.5 py-0.5"
      style={{
        gap: 4,
        borderColor: withAlpha(tone, 0.25),
        backgroundColor: withAlpha(tone, 0.1),
      }}
    >
      <AppIcon name={sales ? "file-text" : Factory} size={12} color={tone} />
      <Text className="text-[11px] font-semibold" style={{ color: tone }}>
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
  icon: IconValue;
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
          <AppIcon name={icon} size={20} color={p.mutedForeground} />
        </View>
        {delta != null ? (
          <View
            className="flex-row items-center gap-1 rounded-sm px-1.5 py-0.5"
            style={{
              backgroundColor:
                delta >= 0 ? `${p.success}1a` : `${p.destructive}1a`,
            }}
          >
            <Feather
              name={delta >= 0 ? "trending-up" : "trending-down"}
              size={12}
              color={delta >= 0 ? p.success : p.destructive}
            />
            <Text
              className="text-[11px] font-medium"
              style={{ color: delta >= 0 ? p.success : p.destructive }}
            >
              {delta >= 0 ? "+" : ""}
              {delta.toFixed(1)}%
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        className="mt-3 text-[11px] font-medium uppercase"
        style={{ color: p.mutedForeground, letterSpacing: 0.66 }}
      >
        {label}
      </Text>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <CountUp
          target={value}
          format={format}
          fontSize={28}
          fontWeight="600"
          color={p.foreground}
          className="mt-1"
        />
      )}
      {sub ? (
        <Text className="mt-1 text-xs" style={{ color: p.mutedForeground }}>
          {sub}
        </Text>
      ) : null}
    </Card>
  );
}

/** One bar: grows from the baseline with the web's 40ms stagger. */
function VolumeBar({
  ratio,
  index,
  color,
}: {
  ratio: number;
  index: number;
  color: string;
}) {
  const reduce = useReduceMotion();
  const grow = useSharedValue(0);
  const lastRatio = useRef(ratio);
  useEffect(() => {
    const from = lastRatio.current;
    lastRatio.current = ratio;
    if (reduce) {
      grow.value = 1;
      return;
    }
    // Value changes tween between heights (web `animate` behaviour); mounts
    // grow from the baseline.
    grow.value = from > 0 && from !== ratio ? from / ratio : 0;
    grow.value = withDelay(
      Math.min(index, 4) * 40,
      withTiming(1, { duration: 200, easing: EASE_OUT }),
    );
  }, [grow, index, ratio, reduce]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: grow.value }],
  }));
  return (
    <Animated.View
      className="flex-1 rounded-t-md"
      style={[
        {
          height: `${ratio * 100}%`,
          transformOrigin: "bottom",
          backgroundColor: color,
        },
        style,
      ]}
    />
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
      <View
        className="flex-row flex-wrap items-baseline"
        style={{ columnGap: 12, rowGap: 4 }}
      >
        <Text
          className="text-[28px] font-bold"
          style={{ color: p.foreground, letterSpacing: -0.62 }}
        >
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
            style={{ gap: 6 }}
            accessibilityRole="image"
            accessibilityLabel="Job-work volume over time bar chart"
          >
            {buckets.map((b, i) => (
              <VolumeBar
                key={b.key}
                ratio={Math.max(b.netWt / max, 0.02)}
                index={i}
                color={withAlpha(p.primary, 0.7)}
              />
            ))}
          </View>
          <View className="mt-2 flex-row" style={{ gap: 6 }}>
            {buckets.map((b, i) => (
              <Text
                key={i}
                className="flex-1 text-center text-[11px] font-medium"
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
          icon="package"
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
  const total = list.reduce((s, c) => s + c.totalNetWt, 0);
  if (total <= 0) {
    return (
      <EmptyState
        icon="users"
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
  const stroke = 12;
  const radius = size / 2 - stroke / 2;
  const inset = stroke;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const isFullCircle = slices.length === 1;
  let acc = 0;

  return (
    <View
      className="flex-row flex-wrap items-center"
      style={{ columnGap: 32, rowGap: 20 }}
    >
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
            top: inset,
            bottom: inset,
            left: inset,
            right: inset,
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
            className="mt-1 text-[11px] font-semibold uppercase"
            style={{ color: p.mutedForeground, letterSpacing: 0.66 }}
          >
            kg Total
          </Text>
        </View>
      </View>
      <View className="min-w-[220px] flex-1" style={{ rowGap: 8 }}>
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
              className="text-right text-sm font-semibold"
              style={{ color: p.foreground }}
            >
              {((v / total) * 100).toFixed(0)}%
            </Text>
            <Text
              className="w-24 text-right text-sm"
              style={{ color: p.mutedForeground }}
            >
              {fmtWt(v)} kg
            </Text>
          </View>
        ))}
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

// The server returns web paths; this maps them onto the phone IA. Keyed by
// `link` (a stable contract) rather than the display label, so relabelling a
// card on the server can't silently strand the tap.
const FLOW_ROUTES: Record<string, string> = {
  "/challans?type=outward": "/(tabs)/outward",
  "/returns": "/returns",
  "/stock/raw": "/stock?kind=raw",
  "/stock/dyed": "/stock?kind=dyed",
  "/challans?type=sales": "/(tabs)/challans",
};

const FLOW_PERMISSIONS: Record<string, Permission[]> = {
  "/challans?type=outward": [
    "create_challan",
    "edit_challan",
    "delete_challan",
  ],
  "/returns": ["create_return"],
  "/stock/raw": ["view_stock"],
  "/stock/dyed": ["view_stock"],
  "/challans?type=sales": ["create_challan", "edit_challan", "delete_challan"],
};

const FLOW_ICONS: Record<string, IconValue> = {
  Sent: Factory,
  Returned: PackageOpen,
  "In Stock Raw": Warehouse,
  "In Stock Dyed": "layers",
  Sold: "file-text",
};

function FlowCards({
  wsId,
  can,
}: {
  wsId: string | undefined;
  can: (permission: Permission) => boolean;
}) {
  const p = usePalette();
  const router = useRouter();
  const cacheKey = wsId ?? "";
  const [cards, setCards] = useState<FlowCardData[]>(
    () => cachedFlowCards[cacheKey] ?? [],
  );

  // Monotonic guard: a slow response (effect load vs realtime-triggered
  // reload) must never clobber a fresher one that already landed.
  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    if (!cacheKey) return;
    const seq = ++loadSeq.current;
    try {
      const res = await api<{ cards: FlowCardData[] }>("/reports/dashboard");
      cachedFlowCards[cacheKey] = res.cards;
      if (seq === loadSeq.current) setCards(res.cards);
    } catch {
      // Non-critical — the dashboard works without it (no view_reports).
    }
  }, [cacheKey]);

  useEffect(() => {
    void load();
  }, [load]);

  // Flow cards aggregate every document type — refresh on any write.
  useRealtimeEvent(
    ["challans", "returns", "raw-material", "packing", "stock"],
    load,
  );

  if (cards.length === 0) return null;

  const visibleCards = cards.filter((card) => {
    const permissions = FLOW_PERMISSIONS[card.link];
    return !permissions || permissions.some((permission) => can(permission));
  });
  if (visibleCards.length === 0) return null;

  return (
    <FadeUp>
      <View className="flex-row flex-wrap" style={{ gap: 12 }}>
        {visibleCards.map((card, idx) => {
          const lastOdd =
            idx === visibleCards.length - 1 && visibleCards.length % 2 === 1;
          return (
            <Pressable
              key={card.label}
              accessibilityRole="button"
              onPress={() => router.push(FLOW_ROUTES[card.link] ?? "/reports")}
              className="rounded-lg border p-3"
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
                  className="h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: p.muted }}
                >
                  <AppIcon
                    name={FLOW_ICONS[card.label] ?? "package"}
                    size={20}
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
                  style={{
                    color: card.value < 0 ? p.destructive : p.foreground,
                  }}
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
    </FadeUp>
  );
}

const QUICK_LINKS: Array<{
  to: string;
  icon: IconValue;
  title: string;
  desc: string;
  permissions: Permission[];
}> = [
  {
    to: "/members",
    icon: "users",
    title: "Members",
    desc: "Invite and manage your team",
    permissions: ["manage_members"],
  },
  {
    to: "/masters",
    icon: "book-open",
    title: "Masters",
    desc: "Customers, job workers, deniers, colors",
    permissions: ["manage_masters"],
  },
  {
    to: "/devices",
    icon: "smartphone",
    title: "Devices",
    desc: "Pair new devices and revoke old ones",
    permissions: ["manage_settings"],
  },
  {
    to: "/settings",
    icon: "settings",
    title: "Settings",
    desc: "Company details and challan numbering",
    permissions: ["manage_settings"],
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
  const p = usePalette();
  const summarySeq = useRef(0);

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
      const seq = ++summarySeq.current;
      summary(currentFy.label, workspace?.id)
        .then((res) => {
          if (cancelled || seq !== summarySeq.current) return;
          setSales(res.sales);
          setOutward(res.outward);
        })
        .catch((err) => {
          if (!cancelled && seq === summarySeq.current) {
            toastError("Could not load dashboard", friendlyError(err));
          }
        })
        .finally(() => {
          if (!cancelled && seq === summarySeq.current) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [currentFy, summary, cacheKey, workspace?.id]),
  );

  // Other devices' challan writes land here live — clearSummaryCache first
  // so the next summary() call bypasses the store's cache.
  const clearSummaryCache = useChallans((s) => s.clearSummaryCache);
  useRealtimeEvent(["challans", "stock"], () => {
    if (!currentFy) return;
    clearSummaryCache();
    const seq = ++summarySeq.current;
    summary(currentFy.label, workspace?.id)
      .then((res) => {
        if (seq !== summarySeq.current) return;
        setSales(res.sales);
        setOutward(res.outward);
      })
      .catch((err) => {
        if (seq === summarySeq.current) {
          toastError("Could not refresh dashboard", friendlyError(err));
        }
      });
  });

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
  const canViewCustomers = can("manage_masters");
  const visibleQuickLinks = QUICK_LINKS.filter((link) =>
    link.permissions.some((permission) => can(permission)),
  );

  return (
    <Screen
      eyebrow={todayLabel}
      title="Overview"
      headerLabel="Dashboard"
      description={`${company?.name ?? workspace?.name ?? "—"} · Financial year ${currentFy?.label ?? "—"}`}
      action={
        canCreate ? (
          <View className="flex-row" style={{ gap: 8 }}>
            <View className="flex-1">
              <Button
                label="New sales challan"
                icon="plus"
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
                icon={Factory}
                variant="outline"
                onPress={() =>
                  router.push({
                    pathname: "/challan-editor",
                    params: { kind: "outward" },
                  })
                }
              />
            </View>
          </View>
        ) : undefined
      }
      banner={<SyncStrip />}
    >
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 48,
          paddingTop: 8,
          gap: 24,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <FlowCards wsId={workspace?.id} can={can} />

        <View
          className="flex-row self-start rounded-md p-1"
          style={{ backgroundColor: p.muted, gap: 2 }}
        >
          {PERIODS.map((option) => {
            const active = period === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setPeriod(option.value)}
                className="rounded-md px-3"
                style={({ pressed }) => ({
                  minHeight: 44,
                  minWidth: 64,
                  justifyContent: "center",
                  backgroundColor: active ? p.card : "transparent",
                  opacity: pressed ? 0.8 : 1,
                  // shadow-soft (globals.css) — active segment lifts off the track
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: active ? 0.05 : 0,
                  shadowRadius: 2,
                  elevation: active ? 1 : 0,
                })}
              >
                <Text
                  className="text-sm font-medium"
                  style={{ color: active ? p.foreground : p.mutedForeground }}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: 12 }}>
          <FadeUp delay={10}>
            <StatCard
              icon="file-text"
              label="Challans issued"
              value={stats.count}
              delta={stats.delta.count}
              sub={`${stats.salesCount} sales · ${stats.outwardCount} job work`}
              loading={loading}
            />
          </FadeUp>
          <FadeUp delay={50}>
            <StatCard
              icon="box"
              label="Total packages"
              value={stats.totalBoxes}
              delta={stats.delta.boxes}
              format={fmtBoxes}
              sub="Boxes & sacks"
              loading={loading}
            />
          </FadeUp>
          <FadeUp delay={90}>
            <StatCard
              icon={Scale}
              label="Net weight"
              value={stats.totalNetWt}
              delta={stats.delta.netWt}
              format={fmtWt}
              sub="Kilograms"
              loading={loading}
            />
          </FadeUp>
          <FadeUp delay={130}>
            <StatCard
              icon="layers"
              label="Job-work sendings"
              value={stats.outwardCount}
              delta={stats.outwardDelta}
              sub="Challans sent for dyeing"
              loading={loading}
            />
          </FadeUp>
        </View>

        <View style={{ gap: 12 }}>
          <Card className="overflow-hidden p-0">
            <CardSectionHeader
              label="Job-work volume over time"
              right={
                <Text className="text-xs" style={{ color: p.mutedForeground }}>
                  Kilograms
                </Text>
              }
            />
            <View style={{ padding: 16 }}>
              {loading ? (
                <Skeleton className="h-52 w-full rounded-md" />
              ) : (
                <VolumeChart buckets={volumeBuckets} />
              )}
            </View>
          </Card>

          <Card className="overflow-hidden p-0">
            <CardSectionHeader
              label="Dispatch by customer"
              right={
                canViewCustomers ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: "/masters",
                        params: { tab: "customers" },
                      })
                    }
                    className="flex-row items-center"
                    style={{ gap: 4 }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: p.primary }}
                    >
                      View customers
                    </Text>
                    <Feather
                      name="arrow-up-right"
                      size={14}
                      color={p.primary}
                    />
                  </Pressable>
                ) : undefined
              }
            />
            <View style={{ padding: 16 }}>
              {loading ? (
                <Skeleton className="h-52 w-full rounded-md" />
              ) : (
                <CustomerDonut list={salesWindow} />
              )}
            </View>
          </Card>
        </View>

        <View style={{ gap: 12 }}>
          <Card className="overflow-hidden p-0">
            <CardSectionHeader
              label="Recent challans"
              right={
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
                  <Feather name="arrow-up-right" size={14} color={p.primary} />
                </Pressable>
              }
            />
            <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
              {loading ? (
                <View className="gap-3" style={{ paddingVertical: 16 }}>
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
                  icon="file-text"
                  title={`No challans yet for FY ${currentFy?.label ?? ""}`}
                  message="Create your first challan to see it here."
                  action={
                    canCreate ? (
                      <Button
                        label="Create challan"
                        onPress={() =>
                          router.push({
                            pathname: "/challan-editor",
                            params: { kind: "sales" },
                          })
                        }
                      />
                    ) : undefined
                  }
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
                      borderBottomColor: withAlpha(p.border, 0.65),
                    })}
                  >
                    <View
                      className="h-7 w-7 items-center justify-center rounded-md"
                      style={{
                        backgroundColor:
                          r.type === "sales" ? p.accentSoft : `${p.warning}1a`,
                      }}
                    >
                      <AppIcon
                        name={r.type === "sales" ? "file-text" : Factory}
                        size={16}
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

          {visibleQuickLinks.length > 0 ? (
            <Card className="overflow-hidden p-0">
              <CardSectionHeader label="Quick links" />
              <View
                style={{
                  paddingHorizontal: 20,
                  paddingTop: 16,
                  paddingBottom: 20,
                }}
              >
                {visibleQuickLinks.map((link, i) => (
                  <FadeUp key={link.to} delay={i * 50}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.push(link.to)}
                      className="flex-row items-center rounded-md px-2 py-3"
                      style={({ pressed }) => ({
                        gap: 12,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <View
                        className="h-7 w-7 items-center justify-center rounded-md"
                        style={{ backgroundColor: p.accentSoft }}
                      >
                        <AppIcon
                          name={link.icon}
                          size={16}
                          color={p.accentInk}
                        />
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
                        size={16}
                        color={p.mutedForeground}
                      />
                    </Pressable>
                  </FadeUp>
                ))}
              </View>
            </Card>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
