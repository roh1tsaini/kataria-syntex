import type { ReactNode } from "react";
import {
  TableSkeleton,
  type SkeletonCol,
} from "@/ui/components/table-skeleton";
import { Skeleton } from "@/ui/components/motion";
import { cn } from "@/ui/lib/cn";

/**
 * Route-level loading skeletons. One skeleton per screen, mirroring that
 * screen's real layout (design.md §3.1): the shell renders these inside its
 * existing page gutter while a route chunk loads, so chrome never flashes.
 */

/* Shared primitives ------------------------------------------------------- */

function Row({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-b border-border px-4 py-2.5 last:border-b-0",
        className,
      )}
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-10 w-full sm:w-64" />
    </div>
  );
}

function CardStrip({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-border bg-muted px-4 py-2.5",
        className,
      )}
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="hidden h-3 w-32 sm:block" />
    </div>
  );
}

/** PageHeader shape: eyebrow + clamp title + description left, action right. */
export function PageHeaderSkeleton({
  desc = true,
  actions = true,
  actionsCount = 1,
}: {
  desc?: boolean;
  actions?: boolean;
  actionsCount?: number;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-1.5 h-8 w-56" />
        {desc && <Skeleton className="mt-2 h-3 w-72" />}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:pb-1">
          {Array.from({ length: actionsCount }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-32 rounded-md" />
          ))}
        </div>
      )}
    </div>
  );
}

/** `.filter-bar` shape: search field + FY select + count badge. */
function FilterBarSkeleton() {
  return (
    <div className="filter-bar mt-6">
      <Skeleton className="h-10 min-w-0 flex-1 rounded-md sm:max-w-[420px]" />
      <Skeleton className="h-10 w-full rounded-md sm:w-44" />
      <Skeleton className="hidden h-6 w-24 rounded-sm lg:block" />
    </div>
  );
}

const DEFAULT_TH = (first: boolean) => cn("py-3.5 pr-3", first && "pl-5");

/** List-page body: filter bar + register card (desktop table / mobile cards). */
function ListBodySkeleton({
  cols,
  rows = 6,
}: {
  cols: SkeletonCol[];
  rows?: number;
}) {
  return (
    <>
      <FilterBarSkeleton />
      <Skeleton className="mt-2 h-3 w-28 lg:hidden" />
      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
        <CardStrip />
        {/* Desktop table */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border micro-label">
                {cols.map((col, j) =>
                  col.skeleton.includes("size-") ? (
                    <th key={j} className="py-3 pr-5">
                      <span className="sr-only">Actions</span>
                    </th>
                  ) : (
                    <th
                      key={j}
                      className={cn(
                        DEFAULT_TH(j === 0),
                        col.skeleton.includes("ml-auto") && "text-right",
                      )}
                    >
                      <Skeleton className="h-3 w-16" />
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <TableSkeleton cols={cols} rows={rows} />
          </table>
        </div>
        {/* Mobile cards */}
        <div className="space-y-3 p-3 sm:hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="space-y-3 rounded-lg border border-border p-4"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-12 rounded-md" />
                <Skeleton className="h-12 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function ChartCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <CardStrip className="bg-muted/35" />
      <div className="p-4">
        <Skeleton className="h-52 w-full rounded-md" />
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="h-full rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="size-10 rounded-lg" />
        <Skeleton className="h-4 w-12 rounded-sm" />
      </div>
      <Skeleton className="mt-3 h-3 w-24" />
      <Skeleton className="mt-2 h-7 w-24" />
    </div>
  );
}

/* Page skeletons ----------------------------------------------------------- */

export function DashboardSkeleton() {
  return (
    <>
      <PageHeaderSkeleton desc={false} actionsCount={2} />
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-9 w-72 rounded-md" />
        <Skeleton className="hidden h-3 w-36 sm:block" />
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="mt-6 grid gap-3 sm:gap-4 lg:grid-cols-2">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
      <div className="mt-6 grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <CardStrip className="bg-muted/35" />
          <div className="p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b border-border/65 py-3 last:border-b-0"
              >
                <Skeleton className="size-10 shrink-0 rounded-md" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
        <div className="h-fit overflow-hidden rounded-lg border border-border bg-card">
          <CardStrip className="bg-muted/35" />
          <div className="p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-md px-2 py-3"
              >
                <Skeleton className="size-7 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="mt-1.5 h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* List pages — column shapes copied from each page's own table. */

const CHALLAN_COLS: SkeletonCol[] = [
  { skeleton: "h-4 w-24", td: "py-2.5 pr-3" },
  { skeleton: "h-4 w-20" },
  { skeleton: "h-4 w-40" },
  { skeleton: "ml-auto h-4 w-10" },
  { skeleton: "ml-auto h-4 w-16" },
  { skeleton: "h-4 w-14", td: "py-2.5" },
  { skeleton: "ml-auto size-8 rounded-md", td: "py-2.5" },
];

export function ChallansListSkeleton() {
  return (
    <>
      <PageHeaderSkeleton />
      <ListBodySkeleton cols={CHALLAN_COLS} />
    </>
  );
}

const RETURNS_COLS: SkeletonCol[] = [
  { skeleton: "h-4 w-40" },
  { skeleton: "h-4 w-24" },
  { skeleton: "h-4 w-24" },
  { skeleton: "ml-auto size-8 rounded-md" },
];

export function ReturnsSkeleton() {
  return (
    <>
      <PageHeaderSkeleton />
      <ListBodySkeleton cols={RETURNS_COLS} />
    </>
  );
}

const RAW_MATERIAL_COLS: SkeletonCol[] = [
  { skeleton: "h-4 w-20" },
  { skeleton: "h-4 w-40" },
  { skeleton: "h-4 w-24" },
  { skeleton: "ml-auto size-8 rounded-md" },
];

export function RawMaterialSkeleton() {
  return (
    <>
      <PageHeaderSkeleton />
      <ListBodySkeleton cols={RAW_MATERIAL_COLS} />
    </>
  );
}

const STOCK_COLS: SkeletonCol[] = [
  { skeleton: "h-4 w-44" },
  { skeleton: "h-5 w-20 rounded-sm" },
  { skeleton: "ml-auto h-4 w-8" },
  { skeleton: "ml-auto h-4 w-20" },
];

export function StockSkeleton() {
  return (
    <>
      <PageHeaderSkeleton />
      <ListBodySkeleton cols={STOCK_COLS} />
    </>
  );
}

const PACKING_COLS: SkeletonCol[] = [
  { skeleton: "h-4 w-20" },
  { skeleton: "h-4 w-24" },
  { skeleton: "ml-auto h-4 w-12" },
  { skeleton: "ml-auto h-4 w-16" },
  { skeleton: "ml-auto size-8 rounded-md" },
];

export function PackingSkeleton() {
  return (
    <>
      <PageHeaderSkeleton />
      <ListBodySkeleton cols={PACKING_COLS} />
    </>
  );
}

export function ChallanDetailSkeleton() {
  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Skeleton className="mt-1.5 hidden size-8 shrink-0 rounded-md sm:block" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-7 w-44" />
              <Skeleton className="h-5 w-14 rounded-sm" />
            </div>
            <Skeleton className="mt-2 h-3 w-40" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-24 rounded-md" />
          <Skeleton className="h-10 w-24 rounded-md" />
          <Skeleton className="h-10 w-24 rounded-md" />
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
      <Skeleton className="mt-6 h-64 rounded-lg" />
    </>
  );
}

export function ChallanEditorSkeleton() {
  return (
    <>
      <PageHeaderSkeleton desc={false} actionsCount={2} />
      <div className="mt-6 flex flex-col gap-6">
        <div className="overflow-hidden rounded-lg border border-border bg-card sm:max-w-[640px]">
          <div className="border-b border-border bg-muted px-4 py-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-1 h-3 w-48" />
          </div>
          <div className="space-y-4 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
          <div className="border-b border-border bg-muted px-4 py-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-1 h-3 w-40" />
          </div>
          <div className="flex-1 space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
        <div className="grid overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "p-4",
                i > 0 && "border-t border-border sm:border-t-0 sm:border-l",
              )}
            >
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-5 w-24" />
            </div>
          ))}
        </div>
        <div className="hidden justify-end gap-2 sm:flex">
          <Skeleton className="h-10 w-24 rounded-md" />
          <Skeleton className="h-10 w-28 rounded-md" />
        </div>
      </div>
    </>
  );
}

const REPORT_COLS: SkeletonCol[] = [
  { skeleton: "h-5 w-16 rounded-sm" },
  { skeleton: "h-4 w-32" },
  { skeleton: "h-4 flex-1" },
  { skeleton: "ml-auto h-4 w-20" },
  { skeleton: "ml-auto h-4 w-14" },
];

export function ReportsGridSkeleton() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-lg border border-border bg-card p-4"
          >
            <Skeleton className="size-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-1.5 h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function ReportViewSkeleton() {
  return (
    <>
      <PageHeaderSkeleton desc={false} />
      <div className="filter-bar mt-6">
        <Skeleton className="h-10 w-full rounded-md sm:w-44" />
        <Skeleton className="h-10 w-full rounded-md sm:w-44" />
        <Skeleton className="h-10 w-28 rounded-md" />
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
        <CardStrip />
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border micro-label">
                {REPORT_COLS.map((col, j) => (
                  <th
                    key={j}
                    className={cn(
                      DEFAULT_TH(j === 0),
                      col.skeleton.includes("ml-auto") && "text-right",
                    )}
                  >
                    <Skeleton className="h-3 w-16" />
                  </th>
                ))}
              </tr>
            </thead>
            <TableSkeleton cols={REPORT_COLS} rows={8} />
          </table>
        </div>
        <div className="space-y-3 p-3 sm:hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="space-y-2 rounded-lg border border-border p-4"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function MastersSkeleton() {
  return (
    <>
      <PageHeaderSkeleton desc={false} />
      <div className="mt-6 inline-flex w-max items-center gap-0.5 rounded-md bg-muted p-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-24 rounded-sm" />
        ))}
      </div>
      <div className="filter-bar mt-4">
        <Skeleton className="h-10 min-w-0 flex-1 rounded-md sm:max-w-[420px]" />
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
        <CardStrip />
        <div className="divide-y divide-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-2.5 sm:px-5"
            >
              <Skeleton className="size-10 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-8 w-24 shrink-0 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function ColorsSkeleton() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="mt-6 grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="h-fit overflow-hidden rounded-lg border border-border bg-card">
          <div className="space-y-2.5 border-b border-border p-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-5 w-20 rounded-sm" />
          </div>
          <div className="space-y-2 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <CardStrip />
          <div className="p-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-1.5 h-3 w-48" />
            <div className="mt-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function SettingsSkeleton() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="mt-6 space-y-6">
        {Array.from({ length: 3 }).map((_, s) => (
          <div key={s}>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-1 h-3 w-72" />
            <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
              {Array.from({ length: s === 2 ? 3 : 4 }).map((_, i) => (
                <Row key={i} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function DevicesSkeleton() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="mt-6 rounded-lg border border-border bg-card p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-border py-3 last:border-b-0"
          >
            <Skeleton className="size-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-1.5 h-3 w-56" />
            </div>
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        ))}
      </div>
    </>
  );
}

export function MembersSkeleton() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border bg-muted px-4 py-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-1 h-3 w-40" />
        </div>
        <div className="p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
          <Skeleton className="mt-4 h-10 w-36 rounded-md" />
        </div>
      </div>
      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
        <CardStrip />
        <div className="divide-y divide-border">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-1 h-3 w-44" />
              </div>
              <Skeleton className="h-5 w-16 rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* Standalone routes (outside the shell) ------------------------------------ */

export function AuthSkeleton() {
  return (
    <div className="flex min-h-[calc(100dvh-var(--titlebar-h))] flex-col items-center justify-center gap-6 bg-background p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 rounded-xl" />
        <Skeleton className="h-5 w-44" />
      </div>
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-border bg-card sm:max-w-2xl">
        <div className="p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-3 w-64" />
          <div className="mt-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ScanApproveSkeleton() {
  return (
    <div className="flex min-h-[calc(100dvh-var(--titlebar-h))] items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    </div>
  );
}

export function PrintSkeleton() {
  return (
    <div className="flex min-h-[calc(100dvh-var(--titlebar-h))] flex-col items-center gap-3 bg-muted p-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full max-w-2xl" />
      <Skeleton className="h-40 w-full max-w-2xl" />
    </div>
  );
}

/* Route mapping ------------------------------------------------------------ */

/**
 * Maps a shell pathname to the skeleton shaped like that screen. Paths that
 * are not enumerated (new screens) get a header + generic body that still
 * matches the page scaffold.
 */
export function routeSkeleton(pathname: string): React.ReactNode {
  if (pathname === "/") return <DashboardSkeleton />;
  if (
    /^\/(challans|outward)\/new$/.test(pathname) ||
    /^\/(challans|outward)\/[^/]+\/edit$/.test(pathname)
  ) {
    return <ChallanEditorSkeleton />;
  }
  if (/^\/(challans|outward)\/[^/]+$/.test(pathname)) {
    return <ChallanDetailSkeleton />;
  }
  switch (pathname) {
    case "/challans":
    case "/outward":
      return <ChallansListSkeleton />;
    case "/returns":
      return <ReturnsSkeleton />;
    case "/raw-material":
      return <RawMaterialSkeleton />;
    case "/stock/raw":
    case "/stock/dyed":
      return <StockSkeleton />;
    case "/packing":
      return <PackingSkeleton />;
    case "/reports":
      return <ReportsGridSkeleton />;
    case "/settings":
      return <SettingsSkeleton />;
    case "/masters":
      return <MastersSkeleton />;
    case "/colors":
      return <ColorsSkeleton />;
    case "/devices":
      return <DevicesSkeleton />;
    case "/members":
      return <MembersSkeleton />;
  }
  if (pathname.startsWith("/reports/")) return <ReportViewSkeleton />;
  return (
    <>
      <PageHeaderSkeleton />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </>
  );
}
