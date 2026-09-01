import { useState, useEffect, useCallback } from "react";
import { useMemo } from "react";
import { useDirtyGuard } from "@/ui/hooks/use-dirty-guard";
import { countLabel, TableSkeleton } from "@/ui/components/table-skeleton";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus,
  ArrowLeft,
  Trash2,
  Pencil,
  Search,
  Boxes,
  X,
} from "lucide-react";
import { usePermission } from "@/store/auth";
import { api } from "@/lib/api";
import { useMasters } from "@/store/masters";
import { AppShell } from "@/ui/components/app-shell";
import { PageHeader } from "@/ui/components/page-header";
import { Button } from "@/ui/components/ui/button";
import { Input } from "@/ui/components/ui/input";
import { DatePicker } from "@/ui/components/ui/date-picker";
import { Textarea } from "@/ui/components/ui/textarea";
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

type RawEntry = {
  id: string;
  entryNumber: string;
  supplierId: string | null;
  supplierName: string | null;
  supplierChallanNo: string | null;
  date: string;
  notes: string | null;
};

type Supplier = { id: string; name: string; phone: string | null };
type Denier = { id: string; name: string };
type Color = {
  id: string;
  name: string;
  code: string | null;
  stockType: string;
};

type ItemRow = {
  id: string;
  denierId: string;
  colorId: string;
  netWt: string;
  grossWt: string;
  tareWt: string;
  cones: string;
  lotNo: string;
  boxNo: string;
  packingUnit: "" | "bags" | "boxes";
  packingCount: string;
};

import { round3Str } from "@kataria-syntex/shared";

const today = todayLocal;
const emptyRow = (): ItemRow => ({
  id: crypto.randomUUID(),
  denierId: "",
  colorId: "",
  netWt: "",
  grossWt: "",
  tareWt: "",
  cones: "",
  lotNo: "",
  boxNo: "",
  packingUnit: "",
  packingCount: "",
});

let rawCache: RawEntry[] | null = null;

export function RawMaterialPage() {
  const [params] = useSearchParams();
  const editId = params.get("edit");
  const navigate = useNavigate();
  const can = usePermission();
  const [items, setItems] = useState<RawEntry[]>(() => rawCache ?? []);
  const [loading, setLoading] = useState(() => !rawCache);
  const [loadError, setLoadError] = useState(false);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!rawCache) {
      setLoading(true);
    }
    setLoadError(false);
    try {
      const res = await api<{ items: RawEntry[] }>("/raw-material");
      rawCache = res.items;
      setItems(res.items);
    } catch {
      if (!rawCache) {
        setItems([]);
        setLoadError(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (showForm || editId || editingId) {
    return (
      <RawMaterialForm
        editId={editingId ?? editId ?? undefined}
        onBack={() => {
          setShowForm(false);
          setEditingId(null);
          navigate("/raw-material");
          void load();
        }}
      />
    );
  }

  const filtered = items.filter(
    (i) =>
      !q ||
      i.supplierName?.toLowerCase().includes(q.toLowerCase()) ||
      i.entryNumber?.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <AppShell>
      <PageHeader
        eyebrow="Grey yarn intake"
        title="Raw material"
        description="Grey yarn purchased from suppliers."
        actions={
          can("create_raw_material") ? (
            <Button
              className="w-full sm:w-auto"
              onClick={() => setShowForm(true)}
            >
              <Plus aria-hidden />
              New entry
            </Button>
          ) : undefined
        }
      />

      <div className="filter-bar mt-6">
        <div className="min-w-0 flex-1 w-full sm:max-w-[420px]">
          <InputGroup className="h-10 rounded-md">
            <InputGroupAddon align="inline-start">
              <Search className="size-4 text-muted-foreground" aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search by supplier or entry…"
              aria-label="Search raw material entries"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="text-[15px] sm:text-sm"
            />
            {q && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7 mr-1 shrink-0 rounded-md"
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
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Purchase entries
          </span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Grey yarn intake
          </span>
        </div>
        <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-2.5 sm:hidden">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Entries •{" "}
            {filtered.length > 0 ? `${filtered.length} shown` : "register"}
          </span>
          <span className="text-[11px] text-muted-foreground">Supplier</span>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <>
              {/* Desktop skeleton */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      <th className="py-3.5 pl-5 pr-3 font-inherit">Entry</th>
                      <th className="py-3.5 pr-3 font-inherit">Supplier</th>
                      <th className="py-3.5 pr-3 font-inherit">Date</th>
                      <th className="py-3 pr-5 font-inherit">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <TableSkeleton
                    cols={[
                      { skeleton: "h-4 w-20" },
                      { skeleton: "h-4 w-40" },
                      { skeleton: "h-4 w-24" },
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
                  </div>
                ))}
              </div>
            </>
          ) : loadError ? (
            <Empty className="py-10 px-4">
              <EmptyMedia variant="icon">
                <Boxes className="size-5" aria-hidden />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>Couldn't load entries</EmptyTitle>
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
                <Boxes className="size-5" aria-hidden />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>No raw material entries</EmptyTitle>
                <EmptyDescription>
                  Purchases from suppliers will appear here.
                </EmptyDescription>
              </EmptyHeader>
              {can("create_raw_material") && (
                <EmptyContent>
                  <Button onClick={() => setShowForm(true)}>
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
                    <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      <th className="py-3.5 pl-5 pr-3 font-inherit">Entry</th>
                      <th className="py-3.5 pr-3 font-inherit">Supplier</th>
                      <th className="py-3.5 pr-3 font-inherit">Date</th>
                      <th className="py-3 pr-5 font-inherit">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-border/50 last:border-b-0 transition-colors hover:bg-muted/20"
                      >
                        <td className="py-2.5 pl-5 pr-3">
                          <span className="font-mono text-[13px] font-bold">
                            {item.entryNumber}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 max-w-[240px]">
                          <div className="truncate font-semibold">
                            {item.supplierName ?? "Unknown"}
                          </div>
                          {item.supplierChallanNo && (
                            <div className="truncate text-xs text-muted-foreground">
                              Challan {item.supplierChallanNo}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 font-medium text-muted-foreground whitespace-nowrap">
                          {fmtDate(item.date)}
                        </td>
                        <td className="py-2.5 pr-5 text-right">
                          {can("edit_raw_material") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                navigate(`/raw-material?edit=${item.id}`)
                              }
                              aria-label={`Edit entry ${item.entryNumber}`}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="size-4" aria-hidden />
                            </Button>
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
                  {filtered.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-border bg-card p-3.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-sm font-bold tracking-tight">
                              {item.entryNumber}
                            </span>
                            <span className="truncate text-sm font-semibold">
                              {item.supplierName ?? "Unknown"}
                            </span>
                          </div>
                          <div className="mt-1 text-xs font-medium text-muted-foreground">
                            {fmtDate(item.date)}
                            {item.supplierChallanNo
                              ? ` · Challan ${item.supplierChallanNo}`
                              : ""}
                          </div>
                        </div>
                        {can("edit_raw_material") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              navigate(`/raw-material?edit=${item.id}`)
                            }
                            aria-label={`Edit entry ${item.entryNumber}`}
                            className="-mr-1 -mt-1 size-8 rounded-md text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="size-4" aria-hidden />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}

function RawMaterialForm({
  editId,
  onBack,
}: {
  editId?: string;
  onBack: () => void;
}) {
  const suppliers = useMasters((s) => s.suppliers);
  const deniers = useMasters((s) => s.deniers);
  const colors = useMasters((s) => s.colors);
  const rawColors = useMemo(
    () => colors.filter((c) => c.stockType === "raw"),
    [colors],
  );
  const refreshSuppliers = useMasters((s) => s.refreshSuppliers);
  const refreshDeniers = useMasters((s) => s.refreshDeniers);
  const refreshColors = useMasters((s) => s.refreshColors);
  const [supplierId, setSupplierId] = useState("");
  const [supplierChallanNo, setSupplierChallanNo] = useState("");
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<ItemRow[]>([emptyRow()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [mastersError, setMastersError] = useState(false);
  const [mastersNonce, setMastersNonce] = useState(0);
  const [dirty, setDirty] = useState(false);

  // Warn before closing/reloading the tab with uncommitted edits (browsers
  // show a native confirm — the SPA's own Cancel button runs onBack).
  useDirtyGuard(dirty);

  useEffect(() => {
    setMastersError(false);
    void Promise.all([
      refreshSuppliers(),
      refreshDeniers(),
      refreshColors(),
    ]).catch(() => setMastersError(true));
  }, [mastersNonce, refreshSuppliers, refreshDeniers, refreshColors]);

  useEffect(() => {
    if (!editId) return;
    void (async () => {
      setLoadingDetail(true);
      setDetailError(null);
      try {
        const res = await api<{
          entry: RawEntry;
          items: Array<Record<string, unknown>>;
        }>(`/raw-material/${editId}`);
        const e = res.entry;
        setSupplierId(e.supplierId ?? "");
        setSupplierChallanNo(e.supplierChallanNo ?? "");
        setDate(e.date);
        setNotes(e.notes ?? "");
        const loadedRows = res.items.map((i): ItemRow => ({
          id: crypto.randomUUID(),
          denierId: String(i.denierId ?? ""),
          colorId: String(i.colorId ?? ""),
          netWt: String(i.netWt ?? ""),
          grossWt: String(i.grossWt ?? ""),
          tareWt: String(i.tareWt ?? ""),
          cones: String(i.cones ?? ""),
          lotNo: String(i.lotNo ?? ""),
          boxNo: String(i.boxNo ?? ""),
          packingUnit:
            i.packingUnit === "boxes"
              ? "boxes"
              : i.packingUnit === "bags"
                ? "bags"
                : "",
          packingCount: String(i.packingCount ?? ""),
        }));
        if (loadedRows.length > 0) setRows(loadedRows);
      } catch {
        setDetailError("Couldn't load this entry. Editing is disabled.");
      } finally {
        setLoadingDetail(false);
      }
    })();
  }, [editId]);

  const updateRow = (idx: number, field: keyof ItemRow, value: string) => {
    setDirty(true);
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = { ...r, [field]: value };
        // Net auto-fills from gross − tare while weights are being typed;
        // stays manually editable until a weight changes again.
        if (field === "grossWt" || field === "tareWt") {
          const g = parseFloat(next.grossWt);
          const t = parseFloat(next.tareWt);
          if (!Number.isNaN(g) && !Number.isNaN(t)) {
            next.netWt = round3Str(g - t);
          }
        }
        return next;
      }),
    );
  };
  const addRow = () => {
    setDirty(true);
    setRows((prev) => [...prev, emptyRow()]);
  };
  const removeRow = (idx: number) => {
    setDirty(true);
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };
  const totalWt = rows.reduce((s, r) => s + (parseFloat(r.netWt) || 0), 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (detailError) return;
    if (mastersError) {
      setError("Couldn't load the master data. Retry the load first.");
      return;
    }
    setError(null);
    if (rows.some((r) => !r.denierId || !r.colorId || !r.netWt)) {
      setError("Fill all item fields");
      return;
    }
    setBusy(true);
    try {
      const body = {
        supplierId: supplierId || undefined,
        supplierChallanNo: supplierChallanNo.trim(),
        date,
        notes: notes.trim(),
        items: rows.map((r) => ({
          denierId: r.denierId,
          colorId: r.colorId,
          netWt: parseFloat(r.netWt),
          grossWt: r.grossWt === "" ? undefined : parseFloat(r.grossWt),
          tareWt: r.tareWt === "" ? undefined : parseFloat(r.tareWt),
          cones: r.cones ? parseInt(r.cones) : undefined,
          lotNo: r.lotNo,
          boxNo: r.boxNo.trim(),
          packingUnit: r.packingUnit || undefined,
          packingCount: r.packingCount ? parseInt(r.packingCount) : undefined,
        })),
      };
      if (editId) {
        await api(`/raw-material/${editId}`, { method: "PUT", body });
        toastSuccess("Entry updated", "Raw material entry has been saved.");
      } else {
        await api("/raw-material", { method: "POST", body });
        toastSuccess("Entry created", "Raw material has been recorded.");
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
        <Skeleton className="mt-6 h-40 rounded-lg" />
        <Skeleton className="mt-6 h-64 rounded-lg" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Back to raw material list"
          className="mt-1 shrink-0"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Button>
        <div className="min-w-0">
          <p className="page-eyebrow">{editId ? "Edit" : "New"}</p>
          <h1 className="page-title mt-1.5">
            {editId ? "Edit raw material" : "New raw material"}
          </h1>
        </div>
      </div>

      {mastersError && (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/8 px-4 py-3"
        >
          <p className="text-sm text-destructive">
            Couldn't load deniers, colours and suppliers. Save is disabled until
            they load.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMastersNonce((n) => n + 1)}
          >
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
            <CardTitle className="text-[15px]">Details</CardTitle>
            <CardDescription className="text-xs">
              Record the purchase date. Supplier is optional.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <FieldGroup className="gap-4 sm:grid sm:grid-cols-2">
              <Field>
                <FieldLabel
                  htmlFor="rm-supplier"
                  className="text-xs font-semibold"
                >
                  Supplier{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </FieldLabel>
                <Select
                  value={supplierId || "__none__"}
                  onValueChange={(v) => {
                    setSupplierId(v === "__none__" ? "" : v);
                    setDirty(true);
                  }}
                >
                  <SelectTrigger id="rm-supplier" className="h-11 sm:h-10">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— No supplier —</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="rm-sc" className="text-xs font-semibold">
                  Supplier challan no.
                </FieldLabel>
                <Input
                  id="rm-sc"
                  className="h-11 sm:h-10"
                  value={supplierChallanNo}
                  onChange={(e) => {
                    setSupplierChallanNo(e.target.value);
                    setDirty(true);
                  }}
                  placeholder="e.g. SC-2026-001"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="rm-date" className="text-xs font-semibold">
                  Date
                </FieldLabel>
                <DatePicker
                  id="rm-date"
                  value={date}
                  onChange={(d) => {
                    setDate(d);
                    setDirty(true);
                  }}
                />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel
                  htmlFor="rm-notes"
                  className="text-xs font-semibold"
                >
                  Notes
                </FieldLabel>
                <Textarea
                  id="rm-notes"
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    setDirty(true);
                  }}
                  rows={2}
                  className="min-h-[44px] resize-none"
                  placeholder="Optional notes about this purchase."
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card className="overflow-hidden flex flex-col">
          <CardHeader className="border-b border-border bg-muted px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <CardTitle className="text-[15px]">Items</CardTitle>
                <CardDescription className="text-xs">
                  One row per lot of grey yarn received.
                </CardDescription>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  variant="secondary"
                  className="font-semibold tabular-nums"
                >
                  {rows.length} {rows.length === 1 ? "line" : "lines"}
                </Badge>
                <Badge
                  variant="secondary"
                  className="font-semibold tabular-nums"
                >
                  {fmtWt(totalWt)} kg total
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 pb-4 flex-1">
            <div className="flex flex-col gap-3">
              {rows.map((row, idx) => (
                <div
                  key={row.id}
                  className="rounded-lg border border-border bg-card p-3.5"
                >
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
                    {rows.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(idx)}
                        aria-label={`Remove row ${idx + 1}`}
                        className="size-8 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    <Field className="gap-1.5">
                      <FieldLabel className="text-[11px] font-semibold">
                        Denier
                      </FieldLabel>
                      <Select
                        value={row.denierId}
                        onValueChange={(v) => updateRow(idx, "denierId", v)}
                      >
                        <SelectTrigger className="h-11 sm:h-10">
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
                      <FieldLabel className="text-[11px] font-semibold">
                        Colour (grey/raw)
                      </FieldLabel>
                      <Select
                        value={row.colorId}
                        onValueChange={(v) => updateRow(idx, "colorId", v)}
                      >
                        <SelectTrigger className="h-11 sm:h-10">
                          <SelectValue placeholder="Select colour" />
                        </SelectTrigger>
                        <SelectContent>
                          {rawColors.map((c) => (
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
                      <FieldLabel className="text-[11px] font-semibold">
                        Gross wt (kg)
                      </FieldLabel>
                      <Input
                        className="h-11 sm:h-10"
                        type="number"
                        step="0.001"
                        value={row.grossWt}
                        onChange={(e) =>
                          updateRow(idx, "grossWt", e.target.value)
                        }
                        placeholder="Optional"
                      />
                    </Field>
                    <Field className="gap-1.5">
                      <FieldLabel className="text-[11px] font-semibold">
                        Tare wt (kg)
                      </FieldLabel>
                      <Input
                        className="h-11 sm:h-10"
                        type="number"
                        step="0.001"
                        value={row.tareWt}
                        onChange={(e) =>
                          updateRow(idx, "tareWt", e.target.value)
                        }
                        placeholder="Optional"
                      />
                    </Field>
                    <Field className="gap-1.5">
                      <FieldLabel className="text-[11px] font-semibold">
                        Net wt (kg)
                      </FieldLabel>
                      <Input
                        className="h-11 sm:h-10 font-semibold"
                        type="number"
                        step="0.001"
                        value={row.netWt}
                        onChange={(e) =>
                          updateRow(idx, "netWt", e.target.value)
                        }
                        placeholder="0.000"
                        required
                      />
                    </Field>
                    <Field className="gap-1.5">
                      <FieldLabel className="text-[11px] font-semibold">
                        Cones
                      </FieldLabel>
                      <Input
                        className="h-11 sm:h-10"
                        type="number"
                        value={row.cones}
                        onChange={(e) =>
                          updateRow(idx, "cones", e.target.value)
                        }
                        placeholder="Optional"
                      />
                    </Field>
                  </div>

                  <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    <Field className="gap-1.5">
                      <FieldLabel className="text-[11px] font-semibold">
                        Lot no.
                      </FieldLabel>
                      <Input
                        className="h-11 sm:h-10"
                        value={row.lotNo}
                        onChange={(e) =>
                          updateRow(idx, "lotNo", e.target.value)
                        }
                        placeholder="Optional"
                      />
                    </Field>
                    <Field className="gap-1.5">
                      <FieldLabel className="text-[11px] font-semibold">
                        Box no.
                      </FieldLabel>
                      <Input
                        className="h-11 sm:h-10"
                        value={row.boxNo}
                        onChange={(e) =>
                          updateRow(idx, "boxNo", e.target.value)
                        }
                        placeholder="Optional"
                      />
                    </Field>
                    <Field className="col-span-2 sm:col-span-1 gap-1.5">
                      <FieldLabel className="text-[11px] font-semibold">
                        Packing
                      </FieldLabel>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant={
                            row.packingUnit === "bags" ? "secondary" : "outline"
                          }
                          className="h-11 sm:h-10 px-2.5 text-xs"
                          onClick={() =>
                            updateRow(
                              idx,
                              "packingUnit",
                              row.packingUnit === "bags" ? "" : "bags",
                            )
                          }
                        >
                          Bags
                        </Button>
                        <Button
                          type="button"
                          variant={
                            row.packingUnit === "boxes"
                              ? "secondary"
                              : "outline"
                          }
                          className="h-11 sm:h-10 px-2.5 text-xs"
                          onClick={() =>
                            updateRow(
                              idx,
                              "packingUnit",
                              row.packingUnit === "boxes" ? "" : "boxes",
                            )
                          }
                        >
                          Boxes
                        </Button>
                        <Input
                          className="h-11 sm:h-10 w-full min-w-0 flex-1"
                          type="number"
                          value={row.packingCount}
                          onChange={(e) =>
                            updateRow(idx, "packingCount", e.target.value)
                          }
                          placeholder="—"
                          disabled={!row.packingUnit}
                        />
                      </div>
                    </Field>
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              className="mt-4 w-full border-dashed sm:w-auto"
              onClick={addRow}
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
