import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Factory,
  Scale,
  AlertTriangle,
  ClipboardList,
  Receipt,
  ListTree,
  Users,
  RefreshCw,
  ArrowUpRight,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/ui/components/page-header";
import { Button } from "@/ui/components/ui/button";
import { DatePicker } from "@/ui/components/ui/date-picker";
import { Checkbox } from "@/ui/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui/components/ui/popover";
import { Field, FieldLabel } from "@/ui/components/ui/field";
import { Card, CardContent } from "@/ui/components/ui/card";
import { Badge } from "@/ui/components/ui/badge";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/ui/components/ui/empty";
import { Reveal, Skeleton } from "@/ui/components/motion";
import { cn } from "@/ui/lib/cn";
import { fmtBoxes, fmtWt } from "@/ui/lib/format";
import {
  useAuth,
  registerDataCache,
  api,
  friendlyError,
} from "@kataria-syntex/app-core";
const REPORTS: {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
}[] = [
  {
    id: "job-work-balance",
    label: "Job-Work Balance",
    icon: Scale,
    description: "Sent vs returned per challan",
  },
  {
    id: "over-receipts",
    label: "Over-Receipts",
    icon: AlertTriangle,
    description: "Items received exceeding sent qty",
  },
  {
    id: "stock-summary",
    label: "Stock Summary",
    icon: ClipboardList,
    description: "Stock by denier × colour × lot",
  },
  {
    id: "sales-register",
    label: "Sales Register",
    icon: Receipt,
    description: "All sales challans in a period",
  },
  {
    id: "job-work-register",
    label: "Job-Work Register",
    icon: Factory,
    description: "All outward challans in a period",
  },
  {
    id: "transaction-log",
    label: "Transaction Log",
    icon: ListTree,
    description: "All stock movements chronologically",
  },
  {
    id: "party-summary",
    label: "Party Summary",
    icon: Users,
    description: "Customer & job worker totals",
  },
];

export function ReportsPage() {
  const { reportId } = useParams();

  if (!reportId) {
    return <ReportGrid />;
  }
  return <ReportView reportId={reportId} />;
}

function ReportGrid() {
  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="Reports"
        description="Totals by period, party and stock."
      />

      <Reveal className="mt-6">
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {REPORTS.map((r) => (
            <Link
              key={r.id}
              to={`/reports/${r.id}`}
              className="data-card group flex h-full items-start gap-3 p-4"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <r.icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold tracking-tight">
                  {r.label}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {r.description}
                </p>
              </div>
              <ArrowUpRight
                className="size-4 shrink-0 text-muted-foreground/50 transition-[color,transform] duration-200 ease-[var(--ease-out)] [@media(hover:hover)]:group-hover:translate-x-0.5 [@media(hover:hover)]:group-hover:-translate-y-0.5 [@media(hover:hover)]:group-hover:text-primary"
                aria-hidden
              />
            </Link>
          ))}
        </div>
      </Reveal>
    </>
  );
}

// Keyed by "workspaceId:reportId[?query]" so one account's rows never leak
// into another's. Registered so account resets (logout/401) wipe it — see
// lib/data-caches.
const reportCache: Record<string, { items: Record<string, unknown>[] }> = {};
registerDataCache(() => {
  for (const key of Object.keys(reportCache)) delete reportCache[key];
});

const STORAGE_KEY = "reports.hiddenCols";

function columnLabel(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (s) => s.toUpperCase());
}

function ReportView({ reportId }: { reportId: string }) {
  const navigate = useNavigate();
  const workspaceId = useAuth((s) => s.workspace?.id ?? "");
  const baseKey = `${workspaceId}:${reportId}`;
  const [data, setData] = useState<{ items: Record<string, unknown>[] } | null>(
    () => reportCache[baseKey] ?? null,
  );
  const [loading, setLoading] = useState(() => !reportCache[baseKey]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [hiddenCols, setHiddenCols] = useState<Record<string, boolean>>(() => {
    try {
      const parsed: unknown = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ?? "{}",
      );
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return Object.fromEntries(
          Object.entries(parsed).filter(([, v]) => typeof v === "boolean"),
        ) as Record<string, boolean>;
      }
    } catch {
      // Storage may be blocked or corrupted — start clean.
    }
    return {};
  });

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const cacheKey = `${baseKey}${qs}`;
    if (!reportCache[cacheKey]) {
      setLoading(true);
    }
    setLoadError(null);
    try {
      const res = await api<{ items: Record<string, unknown>[] }>(
        `/reports/${reportId}${qs}`,
      );
      reportCache[cacheKey] = res;
      setData(res);
    } catch (err) {
      // Clear stale rows so a failure never reads as "no data".
      setData(null);
      setLoadError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, [baseKey, reportId, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const report = REPORTS.find((r) => r.id === reportId);
  const title = report?.label ?? "Report";
  const Icon = report?.icon ?? ClipboardList;
  const rows = data?.items ?? [];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const visibleColumns = columns.filter((key) => !hiddenCols[key]);
  // Numeric columns right-align so figures scan like a ledger.
  const numericColumns = new Set(
    columns.filter((key) => rows.some((row) => typeof row[key] === "number")),
  );

  // Drop visibility settings whose column no longer exists in this report.
  useEffect(() => {
    setHiddenCols((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([key]) => columns.includes(key)),
      );
      return Object.keys(next).length === Object.keys(prev).length
        ? prev
        : next;
    });
  }, [columns]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(hiddenCols));
    } catch {
      // Storage unavailable — the toggle just won't persist.
    }
  }, [hiddenCols]);

  const toggleHidden = (key: string) =>
    setHiddenCols((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });

  return (
    <>
      <div className="flex items-start gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/reports")}
          aria-label="Back to reports"
          className="mt-1 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="page-eyebrow">Report</p>
          <h1 className="page-title mt-1.5">{title}</h1>
        </div>
      </div>

      <div className="filter-bar mt-6">
        <Field className="w-40 gap-1.5 sm:w-44">
          <FieldLabel htmlFor="r-from" className="text-xs font-semibold">
            From
          </FieldLabel>
          <DatePicker
            id="r-from"
            value={from}
            onChange={setFrom}
            clearable
            placeholder="From date"
          />
        </Field>
        <Field className="w-40 gap-1.5 sm:w-44">
          <FieldLabel htmlFor="r-to" className="text-xs font-semibold">
            To
          </FieldLabel>
          <DatePicker
            id="r-to"
            value={to}
            onChange={setTo}
            clearable
            placeholder="To date"
          />
        </Field>
      </div>

      {loading ? (
        <Card className="mt-4 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-2.5">
            <span className="micro-label">{title}</span>
            <Skeleton className="h-5 w-16 rounded-sm" />
          </div>
          <div aria-hidden className="divide-y divide-border/60 px-4 sm:px-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-6 py-3.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-14" />
              </div>
            ))}
          </div>
        </Card>
      ) : loadError ? (
        <Card className="mt-4 overflow-hidden">
          <Empty className="px-4 py-10">
            <EmptyMedia
              variant="icon"
              className="bg-destructive/10 text-destructive"
            >
              <AlertTriangle className="size-5" aria-hidden />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>Could not load the report.</EmptyTitle>
              <EmptyDescription>{loadError}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" onClick={() => void load()}>
                <RefreshCw aria-hidden />
                Retry
              </Button>
            </EmptyContent>
          </Empty>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="mt-4 overflow-hidden">
          <Empty className="px-4 py-10">
            <EmptyMedia variant="icon">
              <Icon className="size-5" aria-hidden />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>No data for this period</EmptyTitle>
              <EmptyDescription>
                Adjust the date range or check back after more entries are made.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </Card>
      ) : (
        <Card className="mt-4 overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-border bg-muted px-4 py-2.5">
            <span className="truncate micro-label">{title}</span>
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className="font-medium tabular-nums whitespace-nowrap"
              >
                {rows.length.toLocaleString()}{" "}
                {rows.length === 1 ? "row" : "rows"}
              </Badge>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-md text-muted-foreground hover:text-foreground touch-44"
                    aria-label="Toggle columns"
                  >
                    <SlidersHorizontal aria-hidden />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-52">
                  <p className="px-2 pb-1.5 pt-1 micro-label">Show columns</p>
                  <div className="flex flex-col gap-0.5">
                    {columns.map((key) => {
                      const visible = !hiddenCols[key];
                      const lastVisible =
                        visible && visibleColumns.length === 1;
                      return (
                        <label
                          key={key}
                          className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors [@media(hover:hover)]:hover:bg-muted"
                          onClick={(e) => {
                            // The custom Checkbox is a button, not a native
                            // input — row taps must toggle it, button taps
                            // must not double-fire.
                            if ((e.target as HTMLElement).closest("button")) {
                              return;
                            }
                            toggleHidden(key);
                          }}
                        >
                          <Checkbox
                            checked={visible}
                            disabled={lastVisible}
                            onCheckedChange={() => toggleHidden(key)}
                            aria-label={`Show ${columnLabel(key).toLowerCase()} column`}
                          />
                          {columnLabel(key)}
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border micro-label">
                    {visibleColumns.map((key, i) => (
                      <th
                        key={key}
                        className={cn(
                          "py-3.5",
                          numericColumns.has(key) && "text-right",
                          i === 0 ? "pl-5 pr-3" : "pr-3",
                          i === visibleColumns.length - 1 && "pr-5",
                        )}
                      >
                        {columnLabel(key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item, idx) => (
                    <tr
                      key={(item.id as string | undefined) ?? idx}
                      className="table-row border-b border-border/50 last:border-b-0"
                    >
                      {visibleColumns.map((key, i) => {
                        const val = item[key];
                        const numeric = numericColumns.has(key);
                        return (
                          <td
                            key={key}
                            className={cn(
                              "whitespace-nowrap py-2.5 tabular-nums",
                              numeric && "text-right font-medium",
                              i === 0 ? "pl-5 pr-3" : "pr-3",
                              i === visibleColumns.length - 1 && "pr-5",
                            )}
                          >
                            {typeof val === "number"
                              ? Number.isInteger(val)
                                ? fmtBoxes(val)
                                : fmtWt(val)
                              : val === null || val === undefined
                                ? "—"
                                : String(val)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
