import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Search, Warehouse, Layers, AlertTriangle, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { countLabel, TableSkeleton } from "@/ui/components/table-skeleton";
import { PageHeader } from "@/ui/components/page-header";
import { Button } from "@/ui/components/ui/button";
import { Card, CardContent } from "@/ui/components/ui/card";
import { Badge } from "@/ui/components/ui/badge";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/ui/components/ui/input-group";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/ui/components/ui/empty";
import { Skeleton } from "@/ui/components/motion";
import { cn } from "@/ui/lib/cn";
import { fmtWt } from "@/ui/lib/format";
import { friendlyError } from "@/ui/lib/errors";

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

// Keyed by workspace id so one account's stock never leaks into another's.
const stockCache: Record<
  string,
  Record<"raw" | "dyed", StockGroup[] | null>
> = {};

export function StockPage() {
  const location = useLocation();
  const [params] = useSearchParams();
  const stockType =
    location.pathname.endsWith("/raw") || params.get("type") === "raw"
      ? "raw"
      : "dyed";
  const workspaceId = useAuth((s) => s.workspace?.id ?? "");
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

  const load = useCallback(async () => {
    const type = stockType;
    if (!stockCache[workspaceId]?.[type]) {
      setLoading(true);
    }
    setLoadError(null);
    try {
      const res = await api<{ items: StockGroup[] }>(`/stock?type=${type}`);
      if (type !== stockTypeRef.current) return;
      (stockCache[workspaceId] ??= { raw: null, dyed: null })[type] = res.items;
      setItems(res.items);
    } catch (err) {
      if (type === stockTypeRef.current && !stockCache[workspaceId]?.[type]) {
        setItems([]);
        setLoadError(friendlyError(err));
      }
    } finally {
      if (type === stockTypeRef.current) setLoading(false);
    }
  }, [stockType, workspaceId]);

  useEffect(() => {
    const cached = stockCache[workspaceId]?.[stockType];
    if (cached) {
      setItems(cached);
      setLoading(false);
    }
    void load();
  }, [load, stockType, workspaceId]);

  const filtered = items.filter(
    (i) =>
      !q ||
      i.denierName?.toLowerCase().includes(q.toLowerCase()) ||
      i.colorName?.toLowerCase().includes(q.toLowerCase()),
  );

  const totalKg = filtered.reduce((s, i) => s + i.totalWt, 0);
  const Icon = stockType === "raw" ? Warehouse : Layers;

  const lotChip = (item: StockGroup) => (
    <Badge variant="secondary" className="whitespace-nowrap px-2 py-1">
      {item.lotNo === "Unlabelled" ? "Unlabelled" : `Lot: ${item.lotNo}`}
    </Badge>
  );

  return (
    <>
      <PageHeader
        eyebrow={stockType === "raw" ? "Grey yarn" : "Dyed yarn"}
        title={stockType === "raw" ? "Raw stock" : "Dyed stock"}
        actions={
          <Card className="w-full sm:w-auto sm:min-w-[220px]">
            <CardContent className="flex items-center justify-between gap-6 p-4">
              <div>
                <p className="micro-label">Total</p>
                <p
                  className={cn(
                    "page-title mt-1 tabular-nums",
                    totalKg < 0 && "text-destructive",
                  )}
                >
                  {fmtWt(totalKg)}{" "}
                  <span className="text-sm font-semibold text-muted-foreground">
                    kg
                  </span>
                </p>
              </div>
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <Icon className="size-5" aria-hidden />
              </span>
            </CardContent>
          </Card>
        }
      />

      <div className="filter-bar mt-6">
        <div className="min-w-0 flex-1 w-full sm:max-w-[420px]">
          <InputGroup className="h-10 rounded-md">
            <InputGroupAddon align="inline-start">
              <Search className="size-4 text-muted-foreground" aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search by denier or colour…"
              aria-label="Search stock"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="text-[15px] sm:text-sm"
            />
            {q && (
              <Button
                variant="ghost"
                size="icon"
                className="mr-1 shrink-0 rounded-md touch-44"
                onClick={() => setQ("")}
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </Button>
            )}
          </InputGroup>
        </div>
        <Badge
          variant="secondary"
          className="ml-auto hidden whitespace-nowrap font-medium tabular-nums lg:inline-flex"
        >
          {loading
            ? "Refreshing…"
            : countLabel(filtered.length, "group", "groups", loading)}
        </Badge>
      </div>

      <div className="mt-2 text-xs tabular-nums text-muted-foreground lg:hidden">
        {loading
          ? "Refreshing…"
          : countLabel(filtered.length, "group", "groups", loading)}
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="hidden sm:flex items-center justify-between border-b border-border bg-muted px-4 py-2.5">
          <span className="micro-label">
            {stockType === "raw" ? "Grey yarn lots" : "Dyed yarn lots"}
          </span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Grouped by denier × colour × lot
          </span>
        </div>
        <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-2.5 sm:hidden">
          <span className="micro-label">
            Lots • {filtered.length > 0 ? `${filtered.length} shown` : "stock"}
          </span>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {loading ? "Refreshing…" : `${fmtWt(totalKg)} kg`}
          </span>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <>
              {/* Desktop skeleton */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border micro-label">
                      <th className="py-3.5 pl-5 pr-3">Item</th>
                      <th className="py-3.5 pr-3">Lot</th>
                      <th className="py-3.5 pr-3 text-right">Movements</th>
                      <th className="py-3.5 pr-5 text-right">Net wt (kg)</th>
                    </tr>
                  </thead>
                  <TableSkeleton
                    cols={[
                      { skeleton: "h-4 w-44" },
                      { skeleton: "h-5 w-20 rounded-sm" },
                      { skeleton: "ml-auto h-4 w-8" },
                      { skeleton: "ml-auto h-4 w-20" },
                    ]}
                  />
                </table>
              </div>
              {/* Mobile skeleton */}
              <div className="sm:hidden p-3 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border p-4 space-y-3"
                  >
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-5 w-24 rounded-sm" />
                  </div>
                ))}
              </div>
            </>
          ) : loadError ? (
            <Empty className="py-10 px-4">
              <EmptyMedia variant="icon">
                <Icon className="size-5" aria-hidden />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>Couldn't load stock</EmptyTitle>
                <EmptyDescription>{loadError}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" onClick={() => void load()}>
                  Retry
                </Button>
              </EmptyContent>
            </Empty>
          ) : filtered.length === 0 ? (
            <Empty className="py-10 px-4">
              <EmptyMedia variant="icon">
                <Icon className="size-5" aria-hidden />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>No stock yet</EmptyTitle>
                <EmptyDescription>
                  {stockType === "raw"
                    ? "Raw material entries will populate the grey yarn stock."
                    : "Job-work returns will populate the dyed yarn stock."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              {/* Desktop table — ≥640px */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border micro-label">
                      <th className="py-3.5 pl-5 pr-3">Item</th>
                      <th className="py-3.5 pr-3">Lot</th>
                      <th className="py-3.5 pr-3 text-right">Movements</th>
                      <th className="py-3.5 pr-5 text-right">Net wt (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, idx) => (
                      <tr
                        key={`${item.denierId ?? "x"}-${item.colorId ?? "x"}-${item.lotNo}-${idx}`}
                        className="border-b border-border/50 last:border-b-0 transition-colors hover:bg-muted/20"
                      >
                        <td className="py-2.5 pl-5 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-semibold">
                              {item.denierName}
                            </span>
                            {item.colorCode && (
                              <span
                                className="inline-block size-3.5 shrink-0 rounded-full border border-border"
                                style={{ backgroundColor: item.colorCode }}
                                aria-hidden
                              />
                            )}
                            <span className="truncate text-muted-foreground">
                              {item.colorName}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3">{lotChip(item)}</td>
                        <td className="py-2.5 pr-3 text-right font-medium tabular-nums text-muted-foreground">
                          {item.movements}
                        </td>
                        <td className="py-2.5 pr-5 text-right">
                          <div
                            className={cn(
                              "font-bold tabular-nums",
                              item.totalWt < 0 && "text-destructive",
                            )}
                          >
                            {fmtWt(item.totalWt)}
                          </div>
                          {item.totalWt < 0 && (
                            <div className="flex items-center justify-end gap-1 text-xs text-destructive">
                              <AlertTriangle className="size-3" aria-hidden />
                              Negative
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards — <640px */}
              <div className="sm:hidden p-3">
                <div className="space-y-3">
                  {filtered.map((item, idx) => (
                    <div
                      key={`${item.denierId ?? "x"}-${item.colorId ?? "x"}-${item.lotNo}-${idx}`}
                      className="rounded-lg border border-border bg-card p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-semibold">
                              {item.denierName}
                            </span>
                            {item.colorCode && (
                              <span
                                className="inline-block size-3 shrink-0 rounded-full border border-border"
                                style={{ backgroundColor: item.colorCode }}
                                aria-hidden
                              />
                            )}
                            <span className="text-sm text-muted-foreground">
                              {item.colorName}
                            </span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {lotChip(item)}
                            <span className="text-xs text-muted-foreground">
                              {item.movements}{" "}
                              {item.movements === 1 ? "movement" : "movements"}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div
                            className={cn(
                              "text-sm font-bold tabular-nums",
                              item.totalWt < 0 && "text-destructive",
                            )}
                          >
                            {fmtWt(item.totalWt)}{" "}
                            <span className="text-xs font-medium text-muted-foreground">
                              kg
                            </span>
                          </div>
                          {item.totalWt < 0 && (
                            <div className="mt-0.5 flex items-center justify-end gap-1 text-xs text-destructive">
                              <AlertTriangle className="size-3" aria-hidden />
                              Negative
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
