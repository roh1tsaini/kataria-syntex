import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  Box,
  BookOpen,
  Factory,
  FileText,
  Package,
  PackageOpen,
  Warehouse,
  Layers,
  ArrowRight,
  Plus,
  Scale,
  Settings,
  Smartphone,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { useAuth } from "@/store/auth";
import { useChallans, type Challan } from "@/store/challans";
import { api } from "@/lib/api";
import { toastError } from "@/store/toast";

import { PageHeader } from "@/ui/components/page-header";
import { AppShell } from "@/ui/components/app-shell";
import { Button } from "@/ui/components/ui/button";
import { Card, CardContent } from "@/ui/components/ui/card";
import { Badge } from "@/ui/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/ui/components/ui/toggle-group";
import {
  CountUp,
  Reveal,
  Skeleton,
  Stagger,
  StaggerItem,
} from "@/ui/components/motion";
import { cn } from "@/ui/lib/cn";
import { EASE_OUT } from "@/ui/lib/motion";
import { fmtBoxes, fmtWt } from "@/ui/lib/format";

import {
  aggregate,
  inWindow,
  pctDelta,
  prevFilter,
  revenueBuckets,
  type Period,
} from "@/ui/lib/dashboard-math";
import type { RecentChallan } from "@/ui/pages/devices";

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

function TypeBadge({ type }: { type: RecentChallan["type"] }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1",
        type === "sales"
          ? "border-primary/25 bg-primary/10 text-primary"
          : "border-warning/25 bg-warning/10 text-warning",
      )}
    >
      {type === "sales" ? (
        <FileText className="size-3" aria-hidden />
      ) : (
        <Factory className="size-3" aria-hidden />
      )}
      {type === "sales" ? "Sales" : "Job work"}
    </Badge>
  );
}

function VolumeChart({
  buckets,
}: {
  buckets: ReturnType<typeof revenueBuckets>;
}) {
  const reduceMotion = useReducedMotion();
  const max = Math.max(...buckets.map((b) => b.netWt), 1);
  const total = buckets.reduce((s, b) => s + b.netWt, 0);
  const hasData = buckets.some((b) => b.netWt > 0);
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <div className="text-2xl font-bold tracking-[-0.03em] tabular-nums">
          {fmtWt(total)}{" "}
          <span className="text-sm font-medium text-muted-foreground">kg</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {fmtWt(total / Math.max(buckets.length, 1))} kg avg per period
        </div>
      </div>
      {hasData ? (
        <>
          <div
            className="mt-4 flex h-40 items-end gap-1.5"
            role="img"
            aria-label="Dispatch volume over time bar chart"
          >
            {buckets.map((b, i) => (
              <motion.div
                key={b.key}
                initial={reduceMotion ? false : { transform: "scaleY(0)" }}
                animate={{
                  transform: `scaleY(${Math.max(b.netWt / max, 0.02)})`,
                }}
                transition={{
                  duration: reduceMotion ? 0 : 0.22,
                  ease: EASE_OUT,
                  delay: reduceMotion ? 0 : i * 0.02,
                }}
                style={{ transformOrigin: "bottom" }}
                className="flex-1 origin-bottom self-stretch rounded-t-md bg-primary/70 transition-colors [@media(hover:hover)]:hover:bg-primary"
                title={`${b.count > 0 ? `${fmtWt(b.netWt)} kg` : "No dispatch"} · ${b.count} challan${b.count === 1 ? "" : "s"}`}
              />
            ))}
          </div>
          <div className="mt-2 flex gap-1.5">
            {buckets.map((b, i) => (
              <span
                key={i}
                className="flex-1 text-center text-[10px] font-medium text-muted-foreground"
              >
                {b.label}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-4 grid h-40 place-items-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
          No dispatch in this period.
        </div>
      )}
    </div>
  );
}

const DONUT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--muted-foreground)",
];

function CustomerDonut({ list }: { list: Challan[] }) {
  const total = list.reduce((s, c) => s + c.totalNetWt, 0);
  if (total <= 0) {
    return (
      <div className="grid h-40 place-items-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        No sales in this period.
      </div>
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
    total - topTotal > 0 ? [...top, ["Other", total - topTotal] as const] : top;

  let acc = 0;
  const stops = slices.map(([, v], i) => {
    const from = (acc / total) * 360;
    acc += v;
    const to = (acc / total) * 360;
    return `${DONUT_COLORS[i % DONUT_COLORS.length]} ${from.toFixed(1)}deg ${to.toFixed(1)}deg`;
  });

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
      <div
        className="relative size-36 shrink-0 rounded-full"
        style={{ background: `conic-gradient(${stops.join(", ")})` }}
      >
        <div className="absolute inset-3 grid place-items-center rounded-full bg-card">
          <div className="text-center">
            <div className="text-base font-bold leading-none tracking-[-0.03em] tabular-nums">
              {fmtWt(total)}
            </div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              kg Total
            </div>
          </div>
        </div>
      </div>
      <ul className="flex min-w-[220px] flex-1 flex-col gap-2">
        {slices.map(([name, v], i) => (
          <li key={name} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
            <span className="text-sm font-semibold tabular-nums">
              {((v / total) * 100).toFixed(0)}%
            </span>
            <span className="w-24 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
              {fmtWt(v)} kg
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  format,
  sub,
  delta,
  loading,
  tint,
}: {
  icon: typeof Box;
  label: string;
  value: number;
  format?: (n: number) => string;
  sub?: string;
  delta?: number | null;
  loading?: boolean;
  tint?: string;
}) {
  return (
    <Card className="group h-full">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "grid size-8 place-items-center rounded-md bg-muted text-muted-foreground",
              tint,
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
          {delta != null && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
                delta >= 0
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive",
              )}
              title="Change vs the previous period"
            >
              {delta >= 0 ? (
                <TrendingUp className="size-3" aria-hidden />
              ) : (
                <TrendingDown className="size-3" aria-hidden />
              )}
              {delta >= 0 ? "+" : ""}
              {delta.toFixed(1)}%
            </span>
          )}
        </div>
        <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          {label}
        </p>
        {loading ? (
          <Skeleton className="mt-2 h-7 w-24" />
        ) : (
          <p className="mt-1 text-[22px] font-semibold leading-none tracking-tight tabular-nums">
            <CountUp target={value} format={format} />
          </p>
        )}
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

type FlowCard = { label: string; value: number; unit: string; link: string };

// Keyed by workspace id so one account's cards never leak into another's.
let cachedFlowCards: Record<string, FlowCard[]> = {};

function FlowCards() {
  const wsId = useAuth((s) => s.workspace?.id);
  const cacheKey = wsId ?? "";
  const [cards, setCards] = useState<FlowCard[]>(
    () => cachedFlowCards[cacheKey] ?? [],
  );
  const [loading, setLoading] = useState(() => !cachedFlowCards[cacheKey]);

  useEffect(() => {
    if (!cacheKey) return;
    void (async () => {
      try {
        const res = await api<{ cards: FlowCard[] }>("/reports/dashboard");
        cachedFlowCards[cacheKey] = res.cards;
        setCards(res.cards);
      } catch {
        // Non-critical — dashboard works without it
      } finally {
        setLoading(false);
      }
    })();
  }, [cacheKey]);

  if (loading) return null;
  if (cards.length === 0) return null;

  const flowIcons: Record<string, typeof Package> = {
    Sent: Factory,
    Returned: PackageOpen,
    "In Stock Raw": Warehouse,
    "In Stock Dyed": Layers,
    Sold: FileText,
  };

  return (
    <Reveal>
      <div className="mt-6 space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {cards.map((card, idx) => {
            const Icon = flowIcons[card.label] ?? Package;
            const lastOdd = idx === cards.length - 1 && cards.length % 2 === 1;
            return (
              <Link
                key={card.label}
                to={card.link}
                className={
                  "data-card group p-3" +
                  (lastOdd ? " col-span-2 lg:col-span-1" : "")
                }
              >
                <div className="flex items-center gap-1.5">
                  <div className="grid size-6 place-items-center rounded-md bg-muted text-muted-foreground">
                    <Icon className="size-3.5" />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {card.label}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span
                    className={
                      card.value < 0
                        ? "text-base font-semibold tracking-tight tabular-nums text-destructive"
                        : "text-base font-semibold tracking-tight tabular-nums"
                    }
                  >
                    {card.value.toFixed(3)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {card.unit}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="hidden items-center gap-2 rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground sm:flex">
          <div className="flex items-center gap-1.5">
            <Warehouse className="size-4 text-muted-foreground" /> Raw Stock
          </div>
          <ArrowRight className="size-3" />
          <div className="flex items-center gap-1.5">
            <Package className="size-4 text-muted-foreground" /> Packing
          </div>
          <ArrowRight className="size-3" />
          <div className="flex items-center gap-1.5">
            <Layers className="size-4 text-muted-foreground" /> Dyed Stock
          </div>
          <ArrowRight className="size-3" />
          <div className="flex items-center gap-1.5">
            <Factory className="size-4 text-muted-foreground" /> Sent
          </div>
          <ArrowRight className="size-3" />
          <div className="flex items-center gap-1.5">
            <PackageOpen className="size-4 text-muted-foreground" /> Returned
          </div>
        </div>
      </div>
    </Reveal>
  );
}

// Keyed by workspace id so one account's summary never leaks into another's.
let cachedSummary: Record<string, { sales: Challan[]; outward: Challan[] }> =
  {};

export function Dashboard() {
  const user = useAuth((s) => s.user);
  const workspace = useAuth((s) => s.workspace);
  const company = useAuth((s) => s.company);
  const currentFy = useAuth((s) => s.currentFy);
  const refreshCompany = useAuth((s) => s.refreshCompany);
  const summary = useChallans((s) => s.summary);

  const cacheKey = workspace?.id ?? "";
  const cached = cachedSummary[cacheKey];

  const [sales, setSales] = useState<Challan[]>(() => cached?.sales ?? []);
  const [outward, setOutward] = useState<Challan[]>(
    () => cached?.outward ?? [],
  );
  const [period, setPeriod] = useState<Period>("fy");
  const [loading, setLoading] = useState(() => !cached);

  useEffect(() => {
    void refreshCompany().catch(() => {});
  }, [refreshCompany]);

  useEffect(() => {
    if (!currentFy || !cacheKey) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    if (!cachedSummary[cacheKey]) {
      setLoading(true);
    }
    // Scope the fetch to the current financial year — without it the server
    // returns every challan ever created and the dashboard filters in JS.
    summary(currentFy.label)
      .then((res) => {
        if (cancelled) return;
        cachedSummary[cacheKey] = res;
        setSales(res.sales);
        setOutward(res.outward);
      })
      .catch(() => {
        if (!cancelled)
          toastError("Could not load dashboard", "Try refreshing the page.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentFy, summary, cacheKey]);

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

  const revenueBucketsList = useMemo(
    () => revenueBuckets(sales, period, currentFy?.label ?? ""),
    [sales, period, currentFy],
  );

  const salesWindow = useMemo(() => {
    const fy = currentFy?.label ?? "";
    return sales.filter((c) => inWindow(c, period, fy));
  }, [sales, period, currentFy]);

  const firstName = user?.name.split(" ")[0] ?? "there";
  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <AppShell>
      <Reveal>
        <PageHeader
          eyebrow={todayLabel}
          title={`Welcome back, ${firstName}`}
          description={`${company?.name ?? workspace?.name ?? "—"} · Financial year ${currentFy?.label ?? "—"}`}
          actions={
            <>
              <Button asChild className="flex-1 sm:flex-none">
                <Link to="/challans/new">
                  <Plus aria-hidden />
                  New sales challan
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1 sm:flex-none">
                <Link to="/outward/new">
                  <Factory aria-hidden />
                  New job-work
                </Link>
              </Button>
            </>
          }
        />
      </Reveal>

      {/* Flow-stage cards */}
      <FlowCards />

      {/* Period filter — horizontally scrollable on tiny screens */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
          <ToggleGroup
            type="single"
            value={period}
            onValueChange={(v) => v && setPeriod(v as Period)}
            className="inline-flex justify-start gap-0.5 rounded-md bg-muted p-1 w-max"
            size="sm"
          >
            <ToggleGroupItem
              value="fy"
              className="min-w-16 px-3 text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm"
            >
              This FY
            </ToggleGroupItem>
            <ToggleGroupItem
              value="30d"
              className="min-w-16 px-3 text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm"
            >
              Last 30 days
            </ToggleGroupItem>
            <ToggleGroupItem
              value="all"
              className="min-w-16 px-3 text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm"
            >
              All time
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <p className="text-xs text-muted-foreground hidden sm:block">
          Chips compare vs previous period
        </p>
      </div>

      {/* Stats */}
      <Stagger className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <StaggerItem className="h-full">
          <StatCard
            icon={FileText}
            label="Challans issued"
            value={stats.count}
            delta={stats.delta.count}
            sub={`${stats.salesCount} sales · ${stats.outwardCount} job work`}
            loading={loading}
          />
        </StaggerItem>
        <StaggerItem className="h-full">
          <StatCard
            icon={Box}
            label="Total packages"
            value={stats.totalBoxes}
            delta={stats.delta.boxes}
            format={fmtBoxes}
            sub="Boxes & sacks"
            loading={loading}
          />
        </StaggerItem>
        <StaggerItem className="h-full">
          <StatCard
            icon={Scale}
            label="Net weight"
            value={stats.totalNetWt}
            delta={stats.delta.netWt}
            format={fmtWt}
            sub="Kilograms"
            loading={loading}
          />
        </StaggerItem>
        <StaggerItem className="h-full">
          <StatCard
            icon={Layers}
            label="Job-work sendings"
            value={stats.outwardCount}
            delta={stats.outwardDelta}
            sub="Challans sent for dyeing"
            loading={loading}
          />
        </StaggerItem>
      </Stagger>

      {/* Charts */}
      <div className="mt-6 grid gap-3 sm:gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/70 bg-muted/35 px-4 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Dispatch volume over time
            </span>
            <span className="text-xs text-muted-foreground">Kilograms</span>
          </div>
          <CardContent className="p-4">
            {loading ? (
              <Skeleton className="h-52 w-full rounded-md" />
            ) : (
              <VolumeChart buckets={revenueBucketsList} />
            )}
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/70 bg-muted/35 px-4 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Dispatch by customer
            </span>
            <Link
              to="/masters?tab=customers"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              View customers
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </div>
          <CardContent className="p-4">
            {loading ? (
              <Skeleton className="h-52 w-full rounded-md" />
            ) : (
              <CustomerDonut list={salesWindow} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Recent challans */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/70 bg-muted/35 px-4 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Recent challans
            </span>
            <Link
              to="/challans"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              View all
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </div>
          <CardContent className="pt-0">
            {loading ? (
              <div className="flex flex-col gap-3 py-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-md" />
                    <div className="flex flex-1 flex-col gap-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : recent.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <FileText className="size-5" aria-hidden />
                </div>
                <p className="mt-3 text-[15px] font-semibold">
                  No challans yet for FY {currentFy?.label}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create your first challan to see it here.
                </p>
                <Button asChild className="mt-4">
                  <Link to="/challans/new">
                    Create challan
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  </Link>
                </Button>
              </div>
            ) : (
              <div>
                {recent.map((r) => (
                  <Link
                    key={`${r.type}-${r.id}`}
                    to={`/${r.type === "sales" ? "challans" : "outward"}/${r.id}`}
                    className="group flex items-center gap-3 border-b border-border/65 py-3 transition-colors last:border-b-0 hover:bg-muted/50"
                  >
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-md",
                        r.type === "sales"
                          ? "bg-accent text-accent-foreground"
                          : "bg-warning/10 text-warning",
                      )}
                    >
                      {r.type === "sales" ? (
                        <FileText className="size-4" aria-hidden />
                      ) : (
                        <Factory className="size-4" aria-hidden />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-mono text-[13px] font-bold text-primary">
                          {r.number}
                        </span>
                        <TypeBadge type={r.type} />
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {r.party} · {r.date}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold tabular-nums">
                        {fmtBoxes(r.boxes)}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          {r.type === "sales" ? "boxes" : "sacks"}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {fmtWt(r.netWt)} kg
                      </div>
                    </div>
                    <ArrowUpRight
                      className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden
                    />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick links */}
        <Card className="overflow-hidden h-fit">
          <div className="border-b border-border/70 bg-muted/35 px-4 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Quick links
            </span>
          </div>
          <CardContent className="pt-4">
            <Stagger stagger={0.05} delay={0}>
              {[
                {
                  to: "/members",
                  icon: Users,
                  title: "Members",
                  desc: "Invite and manage your team",
                },
                {
                  to: "/masters",
                  icon: BookOpen,
                  title: "Masters",
                  desc: "Customers, job workers, deniers, colors",
                },
                {
                  to: "/devices",
                  icon: Smartphone,
                  title: "Devices",
                  desc: "Pair new devices and revoke old ones",
                },
                {
                  to: "/settings",
                  icon: Settings,
                  title: "Settings",
                  desc: "Company details and challan numbering",
                },
              ].map(({ to, icon: Icon, title, desc }) => (
                <StaggerItem key={to}>
                  <Link
                    to={to}
                    className="group flex items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-muted/60"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{title}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {desc}
                      </div>
                    </div>
                    <ArrowUpRight
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      aria-hidden
                    />
                  </Link>
                </StaggerItem>
              ))}
            </Stagger>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
