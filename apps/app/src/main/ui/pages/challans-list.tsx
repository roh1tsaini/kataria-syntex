import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { countLabel, TableSkeleton } from "@/ui/components/table-skeleton";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Copy,
  Ellipsis,
  Eye,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  useAuth,
  useChallans,
  type Challan,
  friendlyError,
  toastError,
  toastSuccess,
} from "@kataria-syntex/app-core";
import { PageHeader } from "@/ui/components/page-header";
import { Button } from "@/ui/components/ui/button";
import { Card, CardContent } from "@/ui/components/ui/card";

import { Label } from "@/ui/components/ui/label";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/ui/components/ui/input-group";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/components/ui/select";

import { Badge } from "@/ui/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/ui/components/ui/empty";
import { Skeleton } from "@/ui/components/motion";
import { useConfirm } from "@/ui/components/confirm-dialog";

import { fmtBoxes, fmtWt } from "@/ui/lib/format";
import { type ChallanKind } from "./challans-shared";

function RowMenu({ kind, challan }: { kind: ChallanKind; challan: Challan }) {
  const { remove } = useChallans();
  const { confirm, dialog } = useConfirm();
  const [deleting, setDeleting] = useState(false);

  const onDelete = async () => {
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
    } catch (err) {
      toastError(
        "Could not delete",
        friendlyError(err, "Something went wrong."),
      );
    } finally {
      setDeleting(false);
    }
  };

  const onCopyId = async () => {
    try {
      await navigator.clipboard.writeText(challan.id);
      toastSuccess("Challan ID copied.");
    } catch {
      toastError("Could not copy", "Clipboard is unavailable on this device.");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Actions for ${challan.challanNumber}`}
          >
            <Ellipsis className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className="min-w-[190px]"
        >
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link to={`${kind.listPath}/${challan.id}`}>
                <Eye className="size-4" aria-hidden />
                Open
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={`${kind.listPath}/${challan.id}/print`}>
                <Printer className="size-4" aria-hidden />
                Print
              </Link>
            </DropdownMenuItem>
            {!challan.pendingSync && (
              <DropdownMenuItem asChild>
                <Link to={`${kind.listPath}/${challan.id}/edit`}>
                  <Pencil className="size-4" aria-hidden />
                  Edit
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => void onCopyId()}>
              <Copy className="size-4" aria-hidden />
              Copy ID
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={deleting}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive [&_svg]:text-destructive"
            onSelect={() => void onDelete()}
          >
            <Trash2 className="size-4" aria-hidden />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {dialog}
    </>
  );
}

// ── List ─────────────────────────────────────────────────────────────────────

const LIST_PAGE_SIZE = 25;

export function ChallanListPage({ kind }: { kind: ChallanKind }) {
  const { challans, total, loading, error, refresh } = useChallans();
  const { financialYears, currentFy } = useAuth();
  const [fy, setFy] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const initializedFy = useRef(false);
  const pageCount = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));

  // Reset to the first page whenever the filter changes.
  const prevFilter = useRef<string>(`${kind.type}|${fy}|${q.trim()}`);
  const filterKey = `${kind.type}|${fy}|${q.trim()}`;
  useEffect(() => {
    if (prevFilter.current !== filterKey) {
      prevFilter.current = filterKey;
      setPage(1);
    }
  }, [filterKey]);

  useEffect(() => {
    if (!initializedFy.current && currentFy) {
      initializedFy.current = true;
      setFy(currentFy.label);
    }
  }, [currentFy]);

  useEffect(() => {
    const delay = q.trim() ? 200 : 0;
    const t = setTimeout(
      () =>
        void refresh({
          type: kind.type,
          fy: fy || undefined,
          q: q.trim() || undefined,
          page,
          limit: LIST_PAGE_SIZE,
        }),
      delay,
    );
    return () => clearTimeout(t);
  }, [kind.type, fy, q, page, refresh]);

  return (
    <>
      <PageHeader
        eyebrow={
          kind.type === "sales" ? "Dispatch register" : "Dyeing movement"
        }
        title={kind.title}
        description={kind.desc}
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link to={kind.newPath}>
              <Plus aria-hidden />
              New challan
            </Link>
          </Button>
        }
      />

      <div className="filter-bar mt-6">
        <div className="min-w-0 flex-1 w-full sm:max-w-[420px]">
          <Label htmlFor="challan-search" className="sr-only">
            Search
          </Label>
          <InputGroup className="h-10 rounded-md">
            <InputGroupAddon align="inline-start">
              <Search className="size-4 text-muted-foreground" aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              id="challan-search"
              placeholder={`${kind.searchPlaceholder} or challan #`}
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
        <div className="flex w-full items-center gap-2 sm:w-auto sm:ml-auto">
          <div className="flex h-10 flex-1 items-center gap-1.5 rounded-md border border-border bg-card pl-3 pr-1.5 sm:flex-none">
            <CalendarDays
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <Label htmlFor="fy-filter" className="sr-only">
              Financial year
            </Label>
            <Select value={fy} onValueChange={setFy}>
              <SelectTrigger
                id="fy-filter"
                className="h-full min-w-0 flex-1 border-none bg-transparent shadow-none px-1.5 text-sm font-medium sm:min-w-[164px]"
              >
                <SelectValue placeholder="All FYs">
                  {fy ? `FY ${fy}` : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All financial years</SelectItem>
                {financialYears.map((f) => (
                  <SelectItem key={f.label} value={f.label}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Badge
            variant="secondary"
            className="hidden whitespace-nowrap font-medium tabular-nums lg:inline-flex"
          >
            {loading
              ? "Refreshing…"
              : countLabel(total, "record", "records", loading)}
          </Badge>
        </div>
      </div>
      {/* Mobile count line */}
      <div className="mt-2 flex items-center justify-between lg:hidden">
        <span className="text-xs tabular-nums text-muted-foreground">
          {loading
            ? "Refreshing…"
            : `${total.toLocaleString()} ${total === 1 ? "record" : "records"} • FY ${fy || "All"}`}
        </span>
        {q && (
          <span className="text-xs text-muted-foreground truncate ml-2">
            for “{q}”
          </span>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <Card className="mt-4 overflow-hidden">
        <div className="hidden sm:flex items-center justify-between border-b border-border bg-muted px-4 py-2.5">
          <span className="micro-label">Issued challans</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Select a record to view or print
          </span>
        </div>
        <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-2.5 sm:hidden">
          <span className="micro-label">
            Issued •{" "}
            {challans.length > 0 ? `${challans.length} shown` : "register"}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {kind.party}
          </span>
        </div>

        <CardContent className="p-0">
          {loading && challans.length === 0 ? (
            <>
              {/* Desktop skeleton */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border micro-label">
                      <th className="py-3.5 pl-5 pr-3">Challan no.</th>
                      <th className="py-3.5 pr-3">Date</th>
                      <th className="py-3.5 pr-3">{kind.party}</th>
                      <th className="py-3.5 pr-3 text-right">Boxes</th>
                      <th className="py-3.5 pr-3 text-right">Net wt (kg)</th>
                      <th className="py-3">FY</th>
                      <th className="py-3 pr-5">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <TableSkeleton
                    cols={[
                      { skeleton: "h-4 w-24", td: "py-2.5 pr-3" },
                      { skeleton: "h-4 w-20" },
                      { skeleton: "h-4 w-40" },
                      { skeleton: "ml-auto h-4 w-10" },
                      { skeleton: "ml-auto h-4 w-16" },
                      { skeleton: "h-4 w-14", td: "py-2.5" },
                      { skeleton: "ml-auto size-8 rounded-md", td: "py-2.5" },
                    ]}
                  />
                </table>
              </div>
              {/* Mobile skeleton */}
              <div className="sm:hidden p-3 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border p-4 space-y-3"
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
            </>
          ) : challans.length === 0 ? (
            <Empty className="py-10 px-4">
              <EmptyMedia variant="icon">
                <Plus className="size-5" aria-hidden />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>
                  {kind.emptyHint}
                  {fy ? ` for FY ${fy}` : ""}.
                </EmptyTitle>
                <EmptyDescription>
                  Start a new challan to add it to this register.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild>
                  <Link to={kind.newPath}>
                    Create challan
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  </Link>
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <>
              {/* Desktop table — ≥640px */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 z-[1] bg-card/95">
                    <tr className="border-b border-border micro-label">
                      <th className="py-3.5 pl-5 pr-3">Challan no.</th>
                      <th className="py-3.5 pr-3">Date</th>
                      <th className="py-3.5 pr-3">{kind.party}</th>
                      <th className="py-3.5 pr-3 text-right">Boxes</th>
                      <th className="py-3.5 pr-3 text-right">Net wt (kg)</th>
                      <th className="py-3">FY</th>
                      <th className="py-3 pr-5">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {challans.map((c) => (
                      <tr
                        key={c.id}
                        className="table-row group border-b border-border/50 last:border-b-0"
                      >
                        <td className="py-2.5 pl-5 pr-3">
                          <Link
                            to={`${kind.listPath}/${c.id}`}
                            className="inline-flex items-center gap-1.5 font-mono text-[13px] font-bold tabular-nums text-primary hover:underline underline-offset-2"
                          >
                            {c.challanNumber}
                            <ArrowUpRight
                              className="size-3 opacity-0 transition-opacity group-hover:opacity-100"
                              aria-hidden
                            />
                          </Link>
                          {c.conflict ? (
                            <span className="ml-1.5 inline-flex items-center gap-1 rounded-sm border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-destructive">
                              <AlertTriangle className="size-2.5" aria-hidden />
                              {c.suggestion ? "Clash" : "Failed"}
                            </span>
                          ) : c.pendingSync ? (
                            <span className="ml-1.5 inline-flex items-center gap-1 rounded-sm border border-border bg-muted px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                              <CloudOff className="size-2.5" aria-hidden />
                              To sync
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2.5 pr-3 font-medium tabular-nums text-muted-foreground whitespace-nowrap">
                          {c.date}
                        </td>
                        <td className="py-2.5 pr-3 max-w-[200px]">
                          <div className="truncate font-semibold">
                            {kind.type === "sales"
                              ? c.customerName
                              : c.jobWorkerName}
                          </div>
                          {kind.type === "sales" && c.customerGstin && (
                            <div className="truncate text-xs text-muted-foreground">
                              {c.customerGstin}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-medium tabular-nums">
                          {fmtBoxes(c.totalBoxes)}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-medium tabular-nums">
                          {fmtWt(c.totalNetWt)}
                        </td>
                        <td className="py-2.5 text-xs font-medium text-muted-foreground">
                          <Badge
                            variant="secondary"
                            className="px-2 py-1 tabular-nums"
                          >
                            {c.fyLabel}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-5 text-right">
                          <RowMenu kind={kind} challan={c} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards — <640px */}
              <div className="sm:hidden p-3">
                <div className="space-y-3">
                  {challans.map((c) => (
                    <div
                      key={c.id}
                      className="data-card flex items-start gap-1 p-0 overflow-hidden"
                    >
                      <Link
                        to={`${kind.listPath}/${c.id}`}
                        className="group block min-w-0 flex-1 p-4"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-sm font-bold tabular-nums tracking-tight text-primary">
                              {c.challanNumber}
                            </span>
                            <Badge
                              variant="secondary"
                              className="font-medium tabular-nums tracking-wider text-muted-foreground"
                            >
                              {c.fyLabel}
                            </Badge>
                            {c.conflict ? (
                              <span className="inline-flex items-center gap-1 rounded-sm border border-destructive/20 bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-destructive">
                                <AlertTriangle
                                  className="size-2.5"
                                  aria-hidden
                                />{" "}
                                Clash
                              </span>
                            ) : c.pendingSync ? (
                              <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                                <CloudOff className="size-2.5" aria-hidden /> To
                                sync
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarDays
                              className="size-3 shrink-0"
                              aria-hidden
                            />
                            <span className="font-medium tabular-nums">
                              {c.date}
                            </span>
                            <span
                              className="size-1 rounded-full bg-border shrink-0"
                              aria-hidden
                            />
                            <span className="truncate font-semibold text-foreground">
                              {kind.type === "sales"
                                ? c.customerName
                                : c.jobWorkerName}
                            </span>
                          </div>
                          {kind.type === "sales" && c.customerGstin && (
                            <div className="mt-1 text-[11px] tabular-nums text-muted-foreground truncate">
                              GSTIN {c.customerGstin}
                            </div>
                          )}
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="rounded-md bg-muted px-3 py-2">
                            <div className="micro-label">Boxes</div>
                            <div className="mt-0.5 text-sm font-bold tabular-nums">
                              {fmtBoxes(c.totalBoxes)}
                            </div>
                          </div>
                          <div className="rounded-md bg-muted px-3 py-2">
                            <div className="micro-label">Net wt</div>
                            <div className="mt-0.5 text-sm font-bold tabular-nums text-primary">
                              {fmtWt(c.totalNetWt)}{" "}
                              <span className="text-xs font-medium text-muted-foreground">
                                kg
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                      {/* Menu sits outside the link — keyboard/AT never see a
                          button nested inside a link. */}
                      <div className="shrink-0 pt-2.5 pr-2.5">
                        <RowMenu kind={kind} challan={c} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {total > 0 && pageCount > 1 && (
        <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <span className="text-xs tabular-nums text-muted-foreground order-2 sm:order-1">
            Page {page} of {pageCount.toLocaleString()} ·{" "}
            {total.toLocaleString()} total
          </span>
          <div className="flex items-center gap-2 order-1 sm:order-2 w-full sm:w-auto">
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft aria-hidden />
              Prev
            </Button>
            <span className="sm:hidden flex-1 text-center text-xs font-medium tabular-nums text-muted-foreground">
              {page} / {pageCount}
            </span>
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              disabled={page >= pageCount || loading}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Next
              <ChevronRight aria-hidden />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
