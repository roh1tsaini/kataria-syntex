import { useState, useEffect, useCallback, useRef } from "react";
import { useDirtyGuard } from "@/ui/hooks/use-dirty-guard";
import { useMastersLoad } from "@/ui/hooks/use-masters-load";
import { countLabel, TableSkeleton } from "@/ui/components/table-skeleton";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus,
  ArrowLeft,
  Trash2,
  Pencil,
  Search,
  AlertTriangle,
  PackageOpen,
  X,
} from "lucide-react";
import { usePermission, useAuth } from "@/store/auth";
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
import { cn } from "@/ui/lib/cn";

type ReturnEntry = {
  id: string;
  jobWorkerId: string;
  jobWorkerName: string;
  invoiceNo: string;
  date: string;
  remarks: string | null;
  createdAt: string;
};

type JobWorker = { id: string; name: string; phone: string | null };
type Denier = { id: string; name: string };
type Color = { id: string; name: string; code: string | null };
type Balance = {
  challanId: string;
  challanNumber: string;
  date: string;
  sent: number;
  returned: number;
  balance: number;
};

type ItemRow = {
  id: string;
  challanId: string;
  denierId: string;
  colorId: string;
  lotNo: string;
  netWt: string;
  cones: string;
};

const today = todayLocal;
const emptyRow = (): ItemRow => ({
  id: crypto.randomUUID(),
  challanId: "",
  denierId: "",
  colorId: "",
  lotNo: "",
  netWt: "",
  cones: "",
});

// Keyed by workspace id so one account's entries never leak into another's.
const returnsCache: Record<string, ReturnEntry[] | null> = {};

export function ReturnsPage() {
  const [params] = useSearchParams();
  const editId = params.get("edit");
  const navigate = useNavigate();
  const workspaceId = useAuth((s) => s.workspace?.id ?? "");
  const can = usePermission();
  const [items, setItems] = useState<ReturnEntry[]>(
    () => returnsCache[workspaceId] ?? [],
  );
  const [loading, setLoading] = useState(() => !returnsCache[workspaceId]);
  const [loadError, setLoadError] = useState(false);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!returnsCache[workspaceId]) {
      setLoading(true);
    }
    setLoadError(false);
    try {
      const res = await api<{ items: ReturnEntry[] }>("/returns");
      returnsCache[workspaceId] = res.items;
      setItems(res.items);
    } catch {
      if (!returnsCache[workspaceId]) {
        setItems([]);
        setLoadError(true);
      }
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (showForm || editId || editingId) {
    return (
      <ReturnForm
        editId={editingId ?? editId ?? undefined}
        onBack={() => {
          setShowForm(false);
          setEditingId(null);
          navigate("/returns");
          void load();
        }}
      />
    );
  }

  const filtered = items.filter(
    (i) =>
      !q ||
      i.jobWorkerName?.toLowerCase().includes(q.toLowerCase()) ||
      i.invoiceNo?.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <AppShell>
      <PageHeader
        eyebrow="Job work"
        title="Returns"
        description="Dyed yarn returned from job workers."
        actions={
          can("create_return") ? (
            <Button
              className="w-full sm:w-auto"
              onClick={() => setShowForm(true)}
            >
              <Plus aria-hidden />
              New return
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
              placeholder="Search by job worker or invoice no…"
              aria-label="Search returns"
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
            : countLabel(filtered.length, "return", "returns", loading)}
        </Badge>
      </div>
      <div className="mt-2 text-xs tabular-nums text-muted-foreground lg:hidden">
        {loading
          ? "Refreshing…"
          : countLabel(filtered.length, "return", "returns", loading)}
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="hidden sm:flex items-center justify-between border-b border-border bg-muted px-4 py-2.5">
          <span className="micro-label">Received returns</span>
        </div>
        <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-2.5 sm:hidden">
          <span className="micro-label">
            Returns •{" "}
            {filtered.length > 0 ? `${filtered.length} shown` : "register"}
          </span>
          <span className="text-[11px] text-muted-foreground">Job worker</span>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <>
              {/* Desktop skeleton */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border micro-label">
                      <th className="py-3.5 pl-5 pr-3">Job worker</th>
                      <th className="py-3.5 pr-3">Invoice</th>
                      <th className="py-3.5 pr-3">Date</th>
                      <th className="py-3 pr-5">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <TableSkeleton
                    cols={[
                      { skeleton: "h-4 w-40" },
                      { skeleton: "h-4 w-24" },
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
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                ))}
              </div>
            </>
          ) : loadError ? (
            <Empty className="py-10 px-4">
              <EmptyMedia variant="icon">
                <PackageOpen className="size-5" aria-hidden />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>Couldn't load returns</EmptyTitle>
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
                <PackageOpen className="size-5" aria-hidden />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>No returns yet</EmptyTitle>
                <EmptyDescription>
                  Returns from job workers will appear here.
                </EmptyDescription>
              </EmptyHeader>
              {can("create_return") && (
                <EmptyContent>
                  <Button onClick={() => setShowForm(true)}>
                    Create return
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
                      <th className="py-3.5 pl-5 pr-3">Job worker</th>
                      <th className="py-3.5 pr-3">Invoice</th>
                      <th className="py-3.5 pr-3">Date</th>
                      <th className="py-3 pr-5">
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
                        <td className="py-2.5 pl-5 pr-3 max-w-[240px]">
                          <div className="truncate font-semibold">
                            {item.jobWorkerName}
                          </div>
                          {item.remarks && (
                            <div className="truncate text-xs text-muted-foreground">
                              {item.remarks}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="font-mono text-[13px] font-bold tabular-nums">
                            {item.invoiceNo}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 font-medium tabular-nums text-muted-foreground whitespace-nowrap">
                          {fmtDate(item.date)}
                        </td>
                        <td className="py-2.5 pr-5 text-right">
                          {can("edit_return") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingId(item.id)}
                              aria-label={`Edit return ${item.invoiceNo}`}
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
                      className="rounded-lg border border-border bg-card p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-sm font-semibold">
                              {item.jobWorkerName}
                            </span>
                            <span className="font-mono text-xs font-bold tabular-nums text-muted-foreground">
                              {item.invoiceNo}
                            </span>
                          </div>
                          <div className="mt-1 text-xs font-medium tabular-nums text-muted-foreground">
                            {fmtDate(item.date)}
                            {item.remarks ? ` · ${item.remarks}` : ""}
                          </div>
                        </div>
                        {can("edit_return") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingId(item.id)}
                            aria-label={`Edit return ${item.invoiceNo}`}
                            className="-mr-1 -mt-1 rounded-md text-muted-foreground hover:text-foreground touch-44"
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

function ReturnForm({
  editId,
  onBack,
}: {
  editId?: string;
  onBack: () => void;
}) {
  const jobWorkers = useMasters((s) => s.jobWorkers);
  const deniers = useMasters((s) => s.deniers);
  const colors = useMasters((s) => s.colors);
  const refreshJobWorkers = useMasters((s) => s.refreshJobWorkers);
  const refreshDeniers = useMasters((s) => s.refreshDeniers);
  const refreshColors = useMasters((s) => s.refreshColors);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [jobWorkerId, setJobWorkerId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [date, setDate] = useState(today());
  const [remarks, setRemarks] = useState("");
  const [rows, setRows] = useState<ItemRow[]>([emptyRow()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Warn before closing/reloading the tab with uncommitted edits (browsers
  // show a native confirm — the SPA's own Cancel button runs onBack).
  useDirtyGuard(dirty);

  const { failed: mastersError, retry: retryMasters } = useMastersLoad(() =>
    Promise.all([refreshJobWorkers(), refreshDeniers(), refreshColors()]),
  );

  useEffect(() => {
    if (!editId) return;
    void (async () => {
      setLoadingDetail(true);
      setDetailError(null);
      try {
        const res = await api<{
          returnEntry: ReturnEntry;
          items: Array<Record<string, unknown>>;
        }>(`/returns/${editId}`);
        const r = res.returnEntry;
        setJobWorkerId(r.jobWorkerId);
        setInvoiceNo(r.invoiceNo);
        setDate(r.date);
        setRemarks(r.remarks ?? "");
        const loadedRows = res.items.map((i) => ({
          id: crypto.randomUUID(),
          challanId: String(i.challanId ?? ""),
          denierId: String(i.denierId ?? ""),
          colorId: String(i.colorId ?? ""),
          lotNo: String(i.lotNo ?? ""),
          netWt: String(i.netWt ?? ""),
          cones: String(i.cones ?? ""),
        }));
        if (loadedRows.length > 0) setRows(loadedRows);
        const balRes = await api<{ items: Balance[] }>(
          `/returns/balance/${r.jobWorkerId}`,
        );
        setBalances(balRes.items);
      } catch {
        setDetailError("Couldn't load this return. Editing is disabled.");
      } finally {
        setLoadingDetail(false);
      }
    })();
  }, [editId]);

  const balanceSeq = useRef(0);
  const onJobWorkerChange = async (id: string) => {
    setDirty(true);
    setJobWorkerId(id);
    setRows([emptyRow()]);
    if (!id) {
      setBalances([]);
      return;
    }
    // Drop the response when a newer selection landed first.
    const seq = ++balanceSeq.current;
    try {
      const res = await api<{ items: Balance[] }>(`/returns/balance/${id}`);
      if (seq !== balanceSeq.current) return;
      setBalances(res.items);
    } catch {
      if (seq === balanceSeq.current) setBalances([]);
    }
  };

  const updateRow = (idx: number, field: keyof ItemRow, value: string) => {
    setDirty(true);
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
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

  const getBalance = (challanId: string) =>
    balances.find((b) => b.challanId === challanId);
  const rowOverReceipt = (row: ItemRow) => {
    if (!row.challanId || !row.netWt) return false;
    const bal = getBalance(row.challanId);
    if (!bal) return false;
    return parseFloat(row.netWt) > bal.balance;
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
    if (!jobWorkerId) {
      setError("Select a job worker");
      return;
    }
    if (!invoiceNo.trim()) {
      setError("Enter an invoice number");
      return;
    }
    if (
      rows.some((r) => !r.challanId || !r.denierId || !r.colorId || !r.netWt)
    ) {
      setError("Fill all item fields");
      return;
    }
    setBusy(true);
    try {
      const body = {
        jobWorkerId,
        invoiceNo: invoiceNo.trim(),
        date,
        remarks: remarks.trim(),
        items: rows.map((r) => ({
          challanId: r.challanId,
          denierId: r.denierId,
          colorId: r.colorId,
          lotNo: r.lotNo,
          netWt: parseFloat(r.netWt),
          cones: r.cones ? parseInt(r.cones) : undefined,
        })),
      };
      if (editId) {
        await api(`/returns/${editId}`, { method: "PUT", body });
        toastSuccess(`${invoiceNo} saved.`);
      } else {
        await api("/returns", { method: "POST", body });
        toastSuccess(`${invoiceNo} recorded.`);
      }
      setDirty(false);
      onBack();
    } catch (err) {
      const msg = friendlyError(err);
      setError(msg);
      toastError("Could not save return", msg);
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

  const openBalances = balances.filter((b) => b.balance > 0);

  return (
    <AppShell>
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Back to returns list"
          className="mt-1 shrink-0"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Button>
        <div className="min-w-0">
          <p className="page-eyebrow">{editId ? "Edit" : "New"}</p>
          <h1 className="page-title mt-1.5">
            {editId ? "Edit return" : "New return"}
          </h1>
        </div>
      </div>

      {mastersError && (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/8 px-4 py-3"
        >
          <p className="text-sm text-destructive">
            Couldn't load job workers, deniers and colours. Save is disabled
            until they load.
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
            <CardTitle className="text-[15px]">Details</CardTitle>
            <CardDescription className="text-xs">
              Select the job worker and enter their invoice number.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <FieldGroup className="gap-4 sm:grid sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="r-jw" className="text-xs font-semibold">
                  Job worker
                </FieldLabel>
                <Select
                  value={jobWorkerId}
                  onValueChange={(v) => void onJobWorkerChange(v)}
                  disabled={!!editId}
                >
                  <SelectTrigger id="r-jw" className="h-11 sm:h-10">
                    <SelectValue placeholder="Select job worker" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobWorkers.map((jw) => (
                      <SelectItem key={jw.id} value={jw.id}>
                        {jw.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="r-inv" className="text-xs font-semibold">
                  Invoice number
                </FieldLabel>
                <Input
                  id="r-inv"
                  className="h-11 sm:h-10"
                  value={invoiceNo}
                  onChange={(e) => {
                    setInvoiceNo(e.target.value);
                    setDirty(true);
                  }}
                  placeholder="e.g. INV-2026-001"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="r-date" className="text-xs font-semibold">
                  Date
                </FieldLabel>
                <DatePicker
                  id="r-date"
                  value={date}
                  onChange={(d) => {
                    setDate(d);
                    setDirty(true);
                  }}
                />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel
                  htmlFor="r-remarks"
                  className="text-xs font-semibold"
                >
                  Remarks
                </FieldLabel>
                <Textarea
                  id="r-remarks"
                  value={remarks}
                  onChange={(e) => {
                    setRemarks(e.target.value);
                    setDirty(true);
                  }}
                  rows={2}
                  className="min-h-[44px] resize-none"
                  placeholder="Quality notes, damage, etc. (optional)"
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        {jobWorkerId && balances.length > 0 && (
          <Card className="h-fit overflow-hidden">
            <CardHeader className="border-b border-border bg-muted px-4 py-3">
              <CardTitle className="text-[15px]">
                Pending balances —{" "}
                {jobWorkers.find((j) => j.id === jobWorkerId)?.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 pb-4">
              <div className="grid gap-2 text-sm">
                {openBalances.map((b) => (
                  <div
                    key={b.challanId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2"
                  >
                    <span className="font-mono text-[13px] font-bold">
                      {b.challanNumber}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {fmtDate(b.date)}
                    </span>
                    <Badge variant="outline" className="tabular-nums">
                      Sent: {fmtWt(b.sent)} kg
                    </Badge>
                    <Badge variant="outline" className="tabular-nums">
                      Returned: {fmtWt(b.returned)} kg
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="font-semibold tabular-nums"
                    >
                      Balance: {fmtWt(b.balance)} kg
                    </Badge>
                  </div>
                ))}
                {openBalances.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    All challans fully returned.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="overflow-hidden flex flex-col">
          <CardHeader className="border-b border-border bg-muted px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <CardTitle className="text-[15px]">Items</CardTitle>
                <CardDescription className="text-xs">
                  One row per returned lot, linked to its source challan.
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
              {rows.map((row, idx) => {
                const overReceipt = rowOverReceipt(row);
                const bal = getBalance(row.challanId);
                return (
                  <div
                    key={row.id}
                    className={cn(
                      "rounded-lg border border-border bg-card p-4",
                      overReceipt && "border-destructive/40 bg-destructive/5",
                    )}
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
                          className="rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 touch-44 shrink-0"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      <Field className="gap-1.5">
                        <FieldLabel
                          htmlFor={`row-${row.id}-challan`}
                          className="text-[11px] font-semibold"
                        >
                          Challan
                        </FieldLabel>
                        <Select
                          value={row.challanId}
                          onValueChange={(v) => updateRow(idx, "challanId", v)}
                        >
                          <SelectTrigger
                            id={`row-${row.id}-challan`}
                            className="h-11 sm:h-10"
                          >
                            <SelectValue placeholder="Select challan" />
                          </SelectTrigger>
                          <SelectContent>
                            {balances.map((b) => (
                              <SelectItem key={b.challanId} value={b.challanId}>
                                {b.challanNumber} ({fmtWt(b.balance)} kg left)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field className="gap-1.5">
                        <FieldLabel
                          htmlFor={`row-${row.id}-denier`}
                          className="text-[11px] font-semibold"
                        >
                          Denier
                        </FieldLabel>
                        <Select
                          value={row.denierId}
                          onValueChange={(v) => updateRow(idx, "denierId", v)}
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
                          onValueChange={(v) => updateRow(idx, "colorId", v)}
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

                    <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
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
                            updateRow(idx, "lotNo", e.target.value)
                          }
                          placeholder="Optional"
                        />
                      </Field>
                      <Field className="gap-1.5">
                        <FieldLabel
                          htmlFor={`row-${row.id}-net`}
                          className="text-[11px] font-semibold"
                        >
                          Net wt (kg)
                        </FieldLabel>
                        <Input
                          id={`row-${row.id}-net`}
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
                            updateRow(idx, "cones", e.target.value)
                          }
                          placeholder="Optional"
                        />
                      </Field>
                    </div>

                    {overReceipt && bal && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                        <AlertTriangle className="size-3" aria-hidden />
                        Over-receipt: exceeds balance of {fmtWt(bal.balance)} kg
                        by {fmtWt(parseFloat(row.netWt) - bal.balance)} kg
                      </div>
                    )}
                  </div>
                );
              })}
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
            {editId ? "Update return" : "Create return"}
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
            {editId ? "Update return" : "Create return"}
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
