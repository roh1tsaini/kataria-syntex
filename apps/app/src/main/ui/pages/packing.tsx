import { useState, useEffect, useCallback, useRef } from "react";
import { useDirtyGuard } from "@/ui/hooks/use-dirty-guard";
import { useMastersLoad } from "@/ui/hooks/use-masters-load";
import { countLabel, TableSkeleton } from "@/ui/components/table-skeleton";
import { useSearchParams } from "react-router-dom";
import {
  Plus,
  ArrowLeft,
  Trash2,
  Pencil,
  Search,
  Lock,
  Package,
  X,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { usePermission, useAuth } from "@/store/auth";
import { api } from "@/lib/api";
import { useMasters } from "@/store/masters";
import { AppShell } from "@/ui/components/app-shell";
import { PageHeader } from "@/ui/components/page-header";
import { EASE_OUT } from "@/ui/lib/motion";
import { Button } from "@/ui/components/ui/button";
import { Input } from "@/ui/components/ui/input";
import { DatePicker } from "@/ui/components/ui/date-picker";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/ui/components/ui/card";
import { Badge } from "@/ui/components/ui/badge";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/ui/components/ui/input-group";
import { Field, FieldGroup, FieldLabel } from "@/ui/components/ui/field";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/ui/components/ui/empty";
import { Tabs, TabsList, TabsTrigger } from "@/ui/components/ui/tabs";
import { Skeleton } from "@/ui/components/motion";
import { toastSuccess, toastError } from "@/store/toast";
import { friendlyError } from "@/ui/lib/errors";
import { fmtDate, fmtWt, todayLocal } from "@/ui/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/components/ui/select";
import { cn } from "@/ui/lib/cn";
import { round3Str } from "@kataria-syntex/shared";

type PackingEntry = {
  id: string;
  type: string;
  entryNumber: string;
  date: string;
  createdBy: string;
  items: Array<{ id: string; netWt: number; imported: boolean }>;
  hasImported: boolean;
};

type Denier = { id: string; name: string };
type Color = { id: string; name: string; code: string | null };

type SaleItemRow = {
  id: string;
  denierId: string;
  colorId: string;
  tareWt: string;
  grossWt: string;
  netWt: string;
  cones: string;
  boxNo: string;
  lotNo: string;
  remarks: string;
};

type JobWorkItemRow = {
  id: string;
  denierId: string;
  colorId: string;
  sackWt: string;
  sacks: string;
  netWt: string;
  cones: string;
  lotNo: string;
  remarks: string;
};

const today = todayLocal;
const emptySaleRow = (): SaleItemRow => ({
  id: crypto.randomUUID(),
  denierId: "",
  colorId: "",
  tareWt: "",
  grossWt: "",
  netWt: "",
  cones: "",
  boxNo: "",
  lotNo: "",
  remarks: "",
});
const emptyJobRow = (): JobWorkItemRow => ({
  id: crypto.randomUUID(),
  denierId: "",
  colorId: "",
  sackWt: "",
  sacks: "",
  netWt: "",
  cones: "",
  lotNo: "",
  remarks: "",
});

// Keyed by workspace id so one account's entries never leak into another's.
const packingCache: Record<
  string,
  Record<"sale" | "job_work", PackingEntry[] | null>
> = {};

export function PackingPage() {
  const [params, setParams] = useSearchParams();
  const activeTab = params.get("type") === "job_work" ? "job_work" : "sale";
  const workspaceId = useAuth((s) => s.workspace?.id ?? "");
  const can = usePermission();
  const [items, setItems] = useState<PackingEntry[]>(
    () => packingCache[workspaceId]?.[activeTab] ?? [],
  );
  const [loading, setLoading] = useState(
    () => !packingCache[workspaceId]?.[activeTab],
  );
  const [loadError, setLoadError] = useState(false);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTab, setFormTab] = useState<"sale" | "job_work">(activeTab);
  // Live tab mirror — the callback's captured activeTab can't guard against
  // itself (it would always compare equal).
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const load = useCallback(async () => {
    const tab = activeTab;
    if (!packingCache[workspaceId]?.[tab]) {
      setLoading(true);
    }
    setLoadError(false);
    try {
      const res = await api<{ items: PackingEntry[] }>(`/packing?type=${tab}`);
      if (tab !== activeTabRef.current) return;
      (packingCache[workspaceId] ??= { sale: null, job_work: null })[tab] =
        res.items;
      setItems(res.items);
    } catch {
      if (tab === activeTabRef.current && !packingCache[workspaceId]?.[tab]) {
        setItems([]);
        setLoadError(true);
      }
    } finally {
      if (tab === activeTabRef.current) setLoading(false);
    }
  }, [activeTab, workspaceId]);

  useEffect(() => {
    const cached = packingCache[workspaceId]?.[activeTab];
    if (cached) {
      setItems(cached);
      setLoading(false);
    }
    void load();
  }, [load, activeTab, workspaceId]);

  if (showForm || editingId) {
    return (
      <PackingForm
        type={formTab}
        editId={editingId ?? undefined}
        onBack={() => {
          setShowForm(false);
          setEditingId(null);
          void load();
        }}
      />
    );
  }

  const filtered = items.filter(
    (i) => !q || i.entryNumber?.toLowerCase().includes(q.toLowerCase()),
  );

  const openNewEntry = () => {
    setFormTab(activeTab);
    setShowForm(true);
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Dispatch"
        title="Packing"
        description="Weigh and record yarn before dispatch."
        actions={
          can("create_packing") ? (
            <Button onClick={openNewEntry} className="w-full sm:w-auto">
              <Plus aria-hidden />
              New entry
            </Button>
          ) : undefined
        }
      />

      <div className="mt-6">
        <Tabs value={activeTab} onValueChange={(v) => setParams({ type: v })}>
          <TabsList className="grid w-full grid-cols-2 sm:w-auto">
            <TabsTrigger value="sale">Final yarn</TabsTrigger>
            <TabsTrigger value="job_work">Raw yarn</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="filter-bar mt-6">
        <div className="min-w-0 flex-1 w-full sm:max-w-[420px]">
          <InputGroup className="h-10 rounded-md">
            <InputGroupAddon align="inline-start">
              <Search className="size-4 text-muted-foreground" aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search by entry number…"
              aria-label="Search packing entries"
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
            : countLabel(filtered.length, "entry", "entries", loading)}
        </Badge>
      </div>
      <div className="mt-2 text-xs tabular-nums text-muted-foreground lg:hidden">
        {loading
          ? "Refreshing…"
          : countLabel(filtered.length, "entry", "entries", loading)}
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="hidden sm:flex items-center justify-between border-b border-border bg-muted px-4 py-2.5">
          <span className="micro-label">Packing entries</span>
        </div>
        <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-2.5 sm:hidden">
          <span className="micro-label">
            Entries •{" "}
            {filtered.length > 0 ? `${filtered.length} shown` : "register"}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {activeTab === "sale" ? "Final yarn" : "Raw yarn"}
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
                      <th className="py-3.5 pl-5 pr-3">Entry</th>
                      <th className="py-3.5 pr-3">Date</th>
                      <th className="py-3.5 pr-3 text-right">Items</th>
                      <th className="py-3.5 pr-3 text-right">Net wt (kg)</th>
                      <th className="py-3 pr-5">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <TableSkeleton
                    cols={[
                      { skeleton: "h-4 w-20" },
                      { skeleton: "h-4 w-24" },
                      { skeleton: "ml-auto h-4 w-12" },
                      { skeleton: "ml-auto h-4 w-16" },
                      { skeleton: "ml-auto size-8 rounded-md" },
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
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            </>
          ) : loadError ? (
            <Empty className="py-10 px-4">
              <EmptyMedia variant="icon">
                <Package className="size-5" aria-hidden />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>Couldn't load packing entries</EmptyTitle>
                <EmptyDescription>
                  The server didn't answer. Check your connection and retry.
                </EmptyDescription>
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
                <Package className="size-5" aria-hidden />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>No packing entries yet</EmptyTitle>
                <EmptyDescription>
                  Entries created by packers will appear here.
                </EmptyDescription>
              </EmptyHeader>
              {can("create_packing") && (
                <EmptyContent>
                  <Button onClick={openNewEntry}>
                    Create entry
                    <Plus aria-hidden />
                  </Button>
                </EmptyContent>
              )}
            </Empty>
          ) : (
            <>
              {/* Desktop table — ≥640px */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border micro-label">
                      <th className="py-3.5 pl-5 pr-3">Entry</th>
                      <th className="py-3.5 pr-3">Date</th>
                      <th className="py-3.5 pr-3 text-right">Items</th>
                      <th className="py-3.5 pr-3 text-right">Net wt (kg)</th>
                      <th className="py-3 pr-5">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((entry) => {
                      const totalWt = entry.items.reduce(
                        (s, i) => s + i.netWt,
                        0,
                      );
                      return (
                        <tr
                          key={entry.id}
                          className={cn(
                            "border-b border-border/50 last:border-b-0 transition-colors hover:bg-muted/20",
                            entry.hasImported && "opacity-75",
                          )}
                        >
                          <td className="py-2.5 pl-5 pr-3">
                            <span className="font-mono text-[13px] font-bold tabular-nums">
                              {entry.entryNumber}
                            </span>
                            {entry.hasImported && (
                              <Badge
                                variant="outline"
                                className="ml-1.5 gap-1 border-warning/30 bg-warning/10 text-warning"
                              >
                                <Lock className="size-3" aria-hidden />
                                Locked
                              </Badge>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 font-medium tabular-nums text-muted-foreground whitespace-nowrap">
                            {fmtDate(entry.date)}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-medium tabular-nums">
                            {entry.items.length}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">
                            {fmtWt(totalWt)}
                          </td>
                          <td className="py-2.5 pr-5 text-right">
                            {!entry.hasImported && can("edit_packing") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setFormTab(
                                    entry.type === "job_work"
                                      ? "job_work"
                                      : "sale",
                                  );
                                  setEditingId(entry.id);
                                }}
                                aria-label={`Edit entry ${entry.entryNumber}`}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <Pencil className="size-4" aria-hidden />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards — <640px */}
              <div className="sm:hidden p-3">
                <div className="space-y-3">
                  {filtered.map((entry) => {
                    const totalWt = entry.items.reduce(
                      (s, i) => s + i.netWt,
                      0,
                    );
                    return (
                      <div
                        key={entry.id}
                        className={cn(
                          "rounded-lg border border-border bg-card p-4",
                          entry.hasImported && "opacity-75",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-sm font-bold tabular-nums tracking-tight">
                                {entry.entryNumber}
                              </span>
                              {entry.hasImported && (
                                <Badge
                                  variant="outline"
                                  className="gap-1 border-warning/30 bg-warning/10 text-warning"
                                >
                                  <Lock className="size-3" aria-hidden />
                                  Locked
                                </Badge>
                              )}
                            </div>
                            <div className="mt-1 text-xs font-medium tabular-nums text-muted-foreground">
                              {fmtDate(entry.date)} · {entry.items.length}{" "}
                              {entry.items.length === 1 ? "item" : "items"}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <div className="text-sm font-bold tabular-nums">
                              {fmtWt(totalWt)}{" "}
                              <span className="text-xs font-medium text-muted-foreground">
                                kg
                              </span>
                            </div>
                            {!entry.hasImported && can("edit_packing") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setFormTab(
                                    entry.type === "job_work"
                                      ? "job_work"
                                      : "sale",
                                  );
                                  setEditingId(entry.id);
                                }}
                                aria-label={`Edit entry ${entry.entryNumber}`}
                                className="-mr-1 -mt-1 rounded-md text-muted-foreground hover:text-foreground touch-44"
                              >
                                <Pencil className="size-4" aria-hidden />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}

function PackingForm({
  type,
  editId,
  onBack,
}: {
  type: "sale" | "job_work";
  editId?: string;
  onBack: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const deniers = useMasters((s) => s.deniers);
  const colors = useMasters((s) => s.colors);
  const refreshDeniers = useMasters((s) => s.refreshDeniers);
  const refreshColors = useMasters((s) => s.refreshColors);
  const [date, setDate] = useState(today());
  const [saleRows, setSaleRows] = useState<SaleItemRow[]>([emptySaleRow()]);
  const [jobRows, setJobRows] = useState<JobWorkItemRow[]>([emptyJobRow()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Warn before closing/reloading the tab with uncommitted edits (browsers
  // show a native confirm — the SPA's own Cancel button runs onBack).
  useDirtyGuard(dirty);

  const { failed: mastersError, retry: retryMasters } = useMastersLoad(() =>
    Promise.all([refreshDeniers(), refreshColors()]),
  );

  useEffect(() => {
    if (!editId) return;
    void (async () => {
      setLoadingDetail(true);
      setDetailError(null);
      try {
        const res = await api<{
          entry: { type: string; date: string };
          items: Array<Record<string, unknown>>;
        }>(`/packing/${editId}`);
        setDate(res.entry.date);
        if (res.entry.type === "sale") {
          const loaded = res.items.map((i) => ({
            id: crypto.randomUUID(),
            denierId: String(i.denierId ?? ""),
            colorId: String(i.colorId ?? ""),
            tareWt: String(i.tareWt ?? ""),
            grossWt: String(i.grossWt ?? ""),
            netWt: String(i.netWt ?? ""),
            cones: String(i.cones ?? ""),
            boxNo: String(i.boxNo ?? ""),
            lotNo: String(i.lotNo ?? ""),
            remarks: String(i.remarks ?? ""),
          }));
          if (loaded.length > 0) setSaleRows(loaded);
        } else {
          const loaded = res.items.map((i) => ({
            id: crypto.randomUUID(),
            denierId: String(i.denierId ?? ""),
            colorId: String(i.colorId ?? ""),
            sackWt: String(i.sackWt ?? ""),
            sacks: String(i.sacks ?? ""),
            netWt: String(i.netWt ?? ""),
            cones: String(i.cones ?? ""),
            lotNo: String(i.lotNo ?? ""),
            remarks: String(i.remarks ?? ""),
          }));
          if (loaded.length > 0) setJobRows(loaded);
        }
      } catch {
        // A blank prefill must never be saved over the real record — surface
        // the failure and block submission until the original loads.
        setDetailError("Couldn't load this entry. Editing is disabled.");
      } finally {
        setLoadingDetail(false);
      }
    })();
  }, [editId]);

  const updateSaleRow = (
    idx: number,
    field: keyof SaleItemRow,
    value: string,
  ) => {
    setDirty(true);
    setSaleRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const updated = { ...r, [field]: value };
        if (field === "grossWt" || field === "tareWt") {
          const g = parseFloat(updated.grossWt) || 0;
          const t = parseFloat(updated.tareWt) || 0;
          if (g > 0) updated.netWt = round3Str(g - t);
        }
        return updated;
      }),
    );
  };

  const updateJobRow = (
    idx: number,
    field: keyof JobWorkItemRow,
    value: string,
  ) => {
    setDirty(true);
    setJobRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const updated = { ...r, [field]: value };
        if (field === "sackWt" || field === "sacks") {
          const sw = parseFloat(updated.sackWt) || 0;
          const sk = parseInt(updated.sacks) || 0;
          if (sw > 0 && sk > 0) updated.netWt = round3Str(sw * sk);
        }
        return updated;
      }),
    );
  };

  const totalWt =
    type === "sale"
      ? saleRows.reduce((s, r) => s + (parseFloat(r.netWt) || 0), 0)
      : jobRows.reduce((s, r) => s + (parseFloat(r.netWt) || 0), 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (detailError) return;
    if (mastersError) {
      setError("Couldn't load the master data. Retry the load first.");
      return;
    }
    const rows = type === "sale" ? saleRows : jobRows;
    if (rows.some((r) => !r.denierId || !r.colorId || !r.netWt)) {
      setError("Fill all item fields");
      return;
    }
    setBusy(true);
    try {
      const body =
        type === "sale"
          ? {
              type: "sale" as const,
              date,
              items: saleRows.map((r) => ({
                denierId: r.denierId,
                colorId: r.colorId,
                tareWt: r.tareWt ? parseFloat(r.tareWt) : undefined,
                grossWt: r.grossWt ? parseFloat(r.grossWt) : undefined,
                netWt: parseFloat(r.netWt),
                cones: r.cones ? parseInt(r.cones) : undefined,
                boxNo: r.boxNo || undefined,
                lotNo: r.lotNo || undefined,
                remarks: r.remarks || undefined,
              })),
            }
          : {
              type: "job_work" as const,
              date,
              items: jobRows.map((r) => ({
                denierId: r.denierId,
                colorId: r.colorId,
                sackWt: r.sackWt ? parseFloat(r.sackWt) : undefined,
                sacks: r.sacks ? parseInt(r.sacks) : undefined,
                netWt: parseFloat(r.netWt),
                cones: r.cones ? parseInt(r.cones) : undefined,
                lotNo: r.lotNo || undefined,
                remarks: r.remarks || undefined,
              })),
            };
      if (editId) {
        await api(`/packing/${editId}`, { method: "PUT", body });
        toastSuccess("Packing entry saved.");
      } else {
        await api("/packing", { method: "POST", body });
        toastSuccess("Packing entry recorded.");
      }
      setDirty(false);
      onBack();
    } catch (err) {
      const msg = friendlyError(err);
      setError(msg);
      toastError("Could not save entry", msg);
    } finally {
      setBusy(false);
    }
  };

  if (loadingDetail) {
    return (
      <AppShell>
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="mt-2 h-3 w-36" />
          </div>
        </div>
        <Skeleton className="mt-6 h-32 rounded-lg" />
        <Skeleton className="mt-6 h-64 rounded-lg" />
      </AppShell>
    );
  }

  const rows = type === "sale" ? saleRows : jobRows;

  return (
    <AppShell>
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Back to packing list"
          className="mt-1 shrink-0"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Button>
        <div className="min-w-0">
          <p className="page-eyebrow">
            {editId ? "Edit" : "New"} ·{" "}
            {type === "sale" ? "Final yarn" : "Raw yarn"}
          </p>
          <h1 className="page-title mt-1.5">
            {editId ? "Edit" : "New"}{" "}
            {type === "sale" ? "final yarn" : "raw yarn"} packing
          </h1>
        </div>
      </div>

      {mastersError && (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/8 px-4 py-3"
        >
          <p className="text-sm text-destructive">
            Couldn't load deniers and colours. Save is disabled until they load.
          </p>
          <Button size="sm" variant="outline" onClick={retryMasters}>
            Retry
          </Button>
        </div>
      )}

      {(detailError || error) && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive"
        >
          {detailError ?? error}
        </p>
      )}

      <form onSubmit={submit} className="mt-6 flex flex-col gap-6">
        <Card className="h-fit overflow-hidden">
          <CardHeader className="border-b border-border bg-muted px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <CardTitle className="text-[15px]">Details</CardTitle>
                <CardDescription className="text-xs">
                  Date for this packing entry.
                </CardDescription>
              </div>
              <Badge
                variant="secondary"
                className="shrink-0 font-semibold tabular-nums"
              >
                {fmtWt(totalWt)} kg total
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <FieldGroup className="gap-4 sm:flex-row sm:items-end">
              <Field className="sm:max-w-xs">
                <FieldLabel
                  htmlFor="pack-date"
                  className="text-xs font-semibold"
                >
                  Date
                </FieldLabel>
                <DatePicker
                  id="pack-date"
                  value={date}
                  onChange={(d) => {
                    setDate(d);
                    setDirty(true);
                  }}
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card className="overflow-hidden flex flex-col">
          <CardHeader className="border-b border-border bg-muted px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <CardTitle className="text-[15px]">
                  {type === "sale"
                    ? "Items — Gross / Tare"
                    : "Items — Sack × Weight"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {type === "sale"
                    ? "Weigh each box; net weight is auto-calculated."
                    : "Net weight = sack weight × number of sacks."}
                </CardDescription>
              </div>
              <Badge
                variant="secondary"
                className="shrink-0 font-semibold tabular-nums"
              >
                {rows.length} {rows.length === 1 ? "line" : "lines"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4 pb-4 flex-1">
            <div className="flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {type === "sale"
                  ? saleRows.map((row, idx) => (
                      <motion.div
                        key={row.id}
                        layout={!reduceMotion}
                        initial={
                          reduceMotion
                            ? false
                            : { opacity: 0, y: -8, scale: 0.98 }
                        }
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{
                          opacity: 0,
                          y: -8,
                          scale: 0.98,
                          transition: reduceMotion
                            ? { duration: 0 }
                            : { duration: 0.15, ease: EASE_OUT },
                        }}
                        transition={
                          reduceMotion
                            ? { duration: 0 }
                            : { duration: 0.18, ease: EASE_OUT }
                        }
                      >
                        <div className="rounded-lg border border-border bg-card p-4">
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-2 text-xs font-bold">
                              <span className="grid size-7 place-items-center rounded-md bg-muted text-muted-foreground text-xs">
                                {idx + 1}
                              </span>
                              <span className="text-muted-foreground">
                                Line {idx + 1}
                              </span>
                              {parseFloat(row.netWt) > 0 && (
                                <span className="rounded-sm bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                                  {row.netWt} kg
                                </span>
                              )}
                            </span>
                            {saleRows.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSaleRows((p) =>
                                    p.filter((_, i) => i !== idx),
                                  );
                                  setDirty(true);
                                }}
                                aria-label={`Remove row ${idx + 1}`}
                                className="rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 touch-44 shrink-0"
                              >
                                <Trash2 className="size-4" aria-hidden />
                              </Button>
                            )}
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2.5">
                            <Field className="gap-1.5">
                              <FieldLabel
                                htmlFor={`row-${row.id}-denier`}
                                className="text-[11px] font-semibold"
                              >
                                Denier
                              </FieldLabel>
                              <Select
                                value={row.denierId}
                                onValueChange={(v) =>
                                  updateSaleRow(idx, "denierId", v)
                                }
                              >
                                <SelectTrigger
                                  id={`row-${row.id}-denier`}
                                  className="h-11 sm:h-10"
                                >
                                  <SelectValue placeholder="Select denier" />
                                </SelectTrigger>
                                <SelectContent>
                                  {deniers.map((d) => (
                                    <SelectItem key={d.id} value={d.id}>
                                      {d.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Field>
                            <Field className="gap-1.5">
                              <FieldLabel
                                htmlFor={`row-${row.id}-color`}
                                className="text-[11px] font-semibold"
                              >
                                Colour
                              </FieldLabel>
                              <Select
                                value={row.colorId}
                                onValueChange={(v) =>
                                  updateSaleRow(idx, "colorId", v)
                                }
                              >
                                <SelectTrigger
                                  id={`row-${row.id}-color`}
                                  className="h-11 sm:h-10"
                                >
                                  <SelectValue placeholder="Select colour" />
                                </SelectTrigger>
                                <SelectContent>
                                  {colors.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                      {c.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Field>
                          </div>

                          <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                            <Field className="gap-1.5">
                              <FieldLabel
                                htmlFor={`row-${row.id}-tare`}
                                className="text-[11px] font-semibold"
                              >
                                Tare (kg)
                              </FieldLabel>
                              <Input
                                id={`row-${row.id}-tare`}
                                className="h-11 sm:h-10"
                                type="number"
                                step="0.001"
                                value={row.tareWt}
                                onChange={(e) =>
                                  updateSaleRow(idx, "tareWt", e.target.value)
                                }
                                placeholder="0.000"
                              />
                            </Field>
                            <Field className="gap-1.5">
                              <FieldLabel
                                htmlFor={`row-${row.id}-gross`}
                                className="text-[11px] font-semibold"
                              >
                                Gross (kg)
                              </FieldLabel>
                              <Input
                                id={`row-${row.id}-gross`}
                                className="h-11 sm:h-10"
                                type="number"
                                step="0.001"
                                value={row.grossWt}
                                onChange={(e) =>
                                  updateSaleRow(idx, "grossWt", e.target.value)
                                }
                                placeholder="0.000"
                              />
                            </Field>
                            <Field className="gap-1.5">
                              <FieldLabel
                                htmlFor={`row-${row.id}-net`}
                                className="text-[11px] font-semibold"
                              >
                                Net (kg)
                              </FieldLabel>
                              <Input
                                id={`row-${row.id}-net`}
                                className="h-11 sm:h-10 font-semibold"
                                type="number"
                                step="0.001"
                                value={row.netWt}
                                onChange={(e) =>
                                  updateSaleRow(idx, "netWt", e.target.value)
                                }
                                placeholder="0.000"
                                required
                              />
                            </Field>
                            <Field className="gap-1.5">
                              <FieldLabel
                                htmlFor={`row-${row.id}-cones`}
                                className="text-[11px] font-semibold"
                              >
                                Cones
                              </FieldLabel>
                              <Input
                                id={`row-${row.id}-cones`}
                                className="h-11 sm:h-10"
                                type="number"
                                value={row.cones}
                                onChange={(e) =>
                                  updateSaleRow(idx, "cones", e.target.value)
                                }
                                placeholder="Optional"
                              />
                            </Field>
                          </div>

                          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                            <Field className="gap-1.5">
                              <FieldLabel
                                htmlFor={`row-${row.id}-boxNo`}
                                className="text-[11px] font-semibold"
                              >
                                Box no.
                              </FieldLabel>
                              <Input
                                id={`row-${row.id}-boxNo`}
                                className="h-11 sm:h-10"
                                value={row.boxNo}
                                onChange={(e) =>
                                  updateSaleRow(idx, "boxNo", e.target.value)
                                }
                                placeholder="Optional"
                              />
                            </Field>
                            <Field className="gap-1.5">
                              <FieldLabel
                                htmlFor={`row-${row.id}-lotNo`}
                                className="text-[11px] font-semibold"
                              >
                                Lot no.
                              </FieldLabel>
                              <Input
                                id={`row-${row.id}-lotNo`}
                                className="h-11 sm:h-10"
                                value={row.lotNo}
                                onChange={(e) =>
                                  updateSaleRow(idx, "lotNo", e.target.value)
                                }
                                placeholder="Optional"
                              />
                            </Field>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  : jobRows.map((row, idx) => (
                      <motion.div
                        key={row.id}
                        layout={!reduceMotion}
                        initial={
                          reduceMotion
                            ? false
                            : { opacity: 0, y: -8, scale: 0.98 }
                        }
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{
                          opacity: 0,
                          y: -8,
                          scale: 0.98,
                          transition: reduceMotion
                            ? { duration: 0 }
                            : { duration: 0.15, ease: EASE_OUT },
                        }}
                        transition={
                          reduceMotion
                            ? { duration: 0 }
                            : { duration: 0.18, ease: EASE_OUT }
                        }
                      >
                        <div className="rounded-lg border border-border bg-card p-4">
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-2 text-xs font-bold">
                              <span className="grid size-7 place-items-center rounded-md bg-muted text-muted-foreground text-xs">
                                {idx + 1}
                              </span>
                              <span className="text-muted-foreground">
                                Line {idx + 1}
                              </span>
                              {parseFloat(row.netWt) > 0 && (
                                <span className="rounded-sm bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                                  {row.netWt} kg
                                </span>
                              )}
                            </span>
                            {jobRows.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setJobRows((p) =>
                                    p.filter((_, i) => i !== idx),
                                  );
                                  setDirty(true);
                                }}
                                aria-label={`Remove row ${idx + 1}`}
                                className="rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 touch-44 shrink-0"
                              >
                                <Trash2 className="size-4" aria-hidden />
                              </Button>
                            )}
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2.5">
                            <Field className="gap-1.5">
                              <FieldLabel
                                htmlFor={`row-${row.id}-denier`}
                                className="text-[11px] font-semibold"
                              >
                                Denier
                              </FieldLabel>
                              <Select
                                value={row.denierId}
                                onValueChange={(v) =>
                                  updateJobRow(idx, "denierId", v)
                                }
                              >
                                <SelectTrigger
                                  id={`row-${row.id}-denier`}
                                  className="h-11 sm:h-10"
                                >
                                  <SelectValue placeholder="Select denier" />
                                </SelectTrigger>
                                <SelectContent>
                                  {deniers.map((d) => (
                                    <SelectItem key={d.id} value={d.id}>
                                      {d.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Field>
                            <Field className="gap-1.5">
                              <FieldLabel
                                htmlFor={`row-${row.id}-color`}
                                className="text-[11px] font-semibold"
                              >
                                Colour
                              </FieldLabel>
                              <Select
                                value={row.colorId}
                                onValueChange={(v) =>
                                  updateJobRow(idx, "colorId", v)
                                }
                              >
                                <SelectTrigger
                                  id={`row-${row.id}-color`}
                                  className="h-11 sm:h-10"
                                >
                                  <SelectValue placeholder="Select colour" />
                                </SelectTrigger>
                                <SelectContent>
                                  {colors.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                      {c.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Field>
                          </div>

                          <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                            <Field className="gap-1.5">
                              <FieldLabel
                                htmlFor={`row-${row.id}-sack`}
                                className="text-[11px] font-semibold"
                              >
                                Sack wt (kg)
                              </FieldLabel>
                              <Input
                                id={`row-${row.id}-sack`}
                                className="h-11 sm:h-10"
                                type="number"
                                step="0.001"
                                value={row.sackWt}
                                onChange={(e) =>
                                  updateJobRow(idx, "sackWt", e.target.value)
                                }
                                placeholder="0.000"
                              />
                            </Field>
                            <Field className="gap-1.5">
                              <FieldLabel
                                htmlFor={`row-${row.id}-sacks`}
                                className="text-[11px] font-semibold"
                              >
                                Sacks
                              </FieldLabel>
                              <Input
                                id={`row-${row.id}-sacks`}
                                className="h-11 sm:h-10"
                                type="number"
                                value={row.sacks}
                                onChange={(e) =>
                                  updateJobRow(idx, "sacks", e.target.value)
                                }
                                placeholder="0"
                              />
                            </Field>
                            <Field className="gap-1.5">
                              <FieldLabel
                                htmlFor={`row-${row.id}-net`}
                                className="text-[11px] font-semibold"
                              >
                                Net (kg)
                              </FieldLabel>
                              <Input
                                id={`row-${row.id}-net`}
                                className="h-11 sm:h-10 font-semibold"
                                type="number"
                                step="0.001"
                                value={row.netWt}
                                onChange={(e) =>
                                  updateJobRow(idx, "netWt", e.target.value)
                                }
                                placeholder="0.000"
                                required
                              />
                            </Field>
                            <Field className="gap-1.5">
                              <FieldLabel
                                htmlFor={`row-${row.id}-cones`}
                                className="text-[11px] font-semibold"
                              >
                                Cones
                              </FieldLabel>
                              <Input
                                id={`row-${row.id}-cones`}
                                className="h-11 sm:h-10"
                                type="number"
                                value={row.cones}
                                onChange={(e) =>
                                  updateJobRow(idx, "cones", e.target.value)
                                }
                                placeholder="Optional"
                              />
                            </Field>
                          </div>

                          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                            <Field className="gap-1.5">
                              <FieldLabel
                                htmlFor={`row-${row.id}-lotNo`}
                                className="text-[11px] font-semibold"
                              >
                                Lot no.
                              </FieldLabel>
                              <Input
                                id={`row-${row.id}-lotNo`}
                                className="h-11 sm:h-10"
                                value={row.lotNo}
                                onChange={(e) =>
                                  updateJobRow(idx, "lotNo", e.target.value)
                                }
                                placeholder="Optional"
                              />
                            </Field>
                            <Field className="gap-1.5">
                              <FieldLabel
                                htmlFor={`row-${row.id}-remarks`}
                                className="text-[11px] font-semibold"
                              >
                                Remarks
                              </FieldLabel>
                              <Input
                                id={`row-${row.id}-remarks`}
                                className="h-11 sm:h-10"
                                value={row.remarks}
                                onChange={(e) =>
                                  updateJobRow(idx, "remarks", e.target.value)
                                }
                                placeholder="Optional"
                              />
                            </Field>
                          </div>
                        </div>
                      </motion.div>
                    ))}
              </AnimatePresence>
            </div>

            <Button
              type="button"
              variant="outline"
              className="mt-4 w-full border-dashed sm:w-auto"
              onClick={() => {
                if (type === "sale") setSaleRows((p) => [...p, emptySaleRow()]);
                else setJobRows((p) => [...p, emptyJobRow()]);
                setDirty(true);
              }}
            >
              <Plus aria-hidden />
              Add item
            </Button>
          </CardContent>
        </Card>

        {/* Sticky action bar — mobile only */}
        <div className="sticky-action-bar flex gap-2 sm:hidden">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onBack}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={busy}
            loading={busy}
          >
            {editId ? "Update entry" : "Create entry"}
          </Button>
        </div>

        {/* Desktop actions */}
        <div className="hidden gap-2 sm:flex sm:justify-end">
          <Button type="button" variant="outline" onClick={onBack}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={busy}
            loading={busy}
            className="min-w-36"
          >
            {editId ? "Update entry" : "Create entry"}
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
