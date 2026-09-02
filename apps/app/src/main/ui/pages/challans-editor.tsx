import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useDirtyGuard } from "@/ui/hooks/use-dirty-guard";
import { countLabel, TableSkeleton } from "@/ui/components/table-skeleton";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Copy,
  Download,
  Ellipsis,
  Eye,
  Pencil,
  Plus,
  Printer,
  Save,
  Search,
  SearchX,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/store/auth";
import {
  useChallans,
  type Challan,
  type ChallanItem,
  type ChallanInput,
  type ChallanType,
} from "@/store/challans";
import { ChallanDocument } from "@/ui/components/challan-document";
import { RecipeLinkButton } from "@/ui/components/recipe-detail";
import { printPage } from "@/lib/platform";
import { useMasters } from "@/store/masters";
import { friendlyError } from "@/ui/lib/errors";
import { api, ApiError } from "@/lib/api";
import { toastError, toastSuccess } from "@/store/toast";
import { AppShell } from "@/ui/components/app-shell";
import { PageHeader } from "@/ui/components/page-header";
import { Button } from "@/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/ui/components/ui/card";
import { Input } from "@/ui/components/ui/input";
import { Label } from "@/ui/components/ui/label";
import { DatePicker } from "@/ui/components/ui/date-picker";
import { Checkbox } from "@/ui/components/ui/checkbox";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/ui/components/ui/input-group";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/ui/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/components/ui/select";
import { Textarea } from "@/ui/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/ui/components/ui/dialog";
import { EASE } from "@/ui/lib/motion";
import { fmtBoxes, fmtWt, todayLocal } from "@/ui/lib/format";
import { type ChallanKind } from "./challans-shared";

type ItemRow = {
  key: string;
  boxNo: string;
  cheese: string;
  grossWt: string;
  tareWt: string;
  netWt: string;
  boxes: string;
  denierId: string;
  colorId: string;
  lotNo: string;
  remarks: string;
};

const emptyRow = (): ItemRow => ({
  key: crypto.randomUUID(),
  boxNo: "",
  cheese: "",
  grossWt: "",
  tareWt: "",
  netWt: "",
  boxes: "1",
  denierId: "",
  colorId: "",
  lotNo: "",
  remarks: "",
});

type PackingItem = {
  id: string;
  entryNumber: string;
  date: string;
  denierId: string | null;
  denierName: string;
  colorId: string | null;
  colorName: string;
  colorCode: string | null;
  netWt: number;
  lotNo: string | null;
  boxNo: string | null;
  cones: number | null;
};

function PackingImportDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (items: PackingItem[]) => void;
}) {
  const [entries, setEntries] = useState<
    Array<{
      id: string;
      entryNumber: string;
      date: string;
      items: PackingItem[];
      hasImported: boolean;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** Bumped by Retry — re-runs the fetch without closing the dialog. */
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const res = await api<{
          items: Array<{
            id: string;
            entryNumber: string;
            date: string;
            items: PackingItem[];
            hasImported: boolean;
          }>;
        }>("/packing?type=sale");
        // Flatten to show individual items grouped by entry
        setEntries(
          res.items.filter((e: { hasImported: boolean }) => !e.hasImported),
        );
      } catch {
        setEntries([]);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, reloadNonce]);

  const toggle = (itemId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const importSelected = () => {
    const items: PackingItem[] = [];
    for (const entry of entries) {
      for (const item of entry.items) {
        if (selected.has(item.id)) items.push(item);
      }
    }
    onImport(items);
    onOpenChange(false);
    setSelected(new Set());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import from Packing</DialogTitle>
          <DialogDescription>
            Select packed items to add as challan rows. Only unlocked
            (non-imported) items are shown.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <p className="text-sm text-destructive">
                Couldn't load packing entries.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReloadNonce((n) => n + 1)}
              >
                Retry
              </Button>
            </div>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No packing entries available for import
            </p>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-lg border border-border overflow-hidden"
                >
                  <div className="flex items-center gap-2 border-b border-border/40 bg-muted px-3 py-2">
                    <span className="font-mono text-xs font-semibold">
                      {entry.entryNumber}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {entry.date}
                    </span>
                  </div>
                  {entry.items.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => toggle(item.id)}
                      className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted transition-colors"
                    >
                      {/* Keyboard toggling goes through the checkbox itself;
                          stop pointer clicks here so the row's onClick doesn't
                          double-toggle. */}
                      <Checkbox
                        checked={selected.has(item.id)}
                        onCheckedChange={() => toggle(item.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {item.denierName}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {item.colorName}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.netWt.toFixed(3)} kg
                          {item.lotNo ? ` · Lot: ${item.lotNo}` : ""}
                          {item.boxNo ? ` · Box: ${item.boxNo}` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={importSelected} disabled={selected.size === 0}>
            Import {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ChallanEditorRoute({ kind }: { kind: ChallanKind }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const reduceMotion = useReducedMotion();

  const { detail, create, update, load, clearDetail } = useChallans();
  const {
    customers,
    customersLoading,
    jobWorkers,
    jobWorkersLoading,
    deniers,
    deniersLoading,
    colors,
    colorsLoading,
    refreshCustomers,
    refreshJobWorkers,
    refreshDeniers,
    refreshColors,
  } = useMasters();
  const company = useAuth((s) => s.company);

  const [date, setDate] = useState(todayLocal());
  const [partyId, setPartyId] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<ItemRow[]>([emptyRow()]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const { confirm, dialog } = useConfirm();

  const prefilled = useRef(false);
  const itemRefs = useRef<
    Array<Record<string, HTMLInputElement | HTMLButtonElement> | null>
  >([]);
  const pendingFocus = useRef<{ i: number; field: string } | null>(null);

  const parties = kind.type === "sales" ? customers : jobWorkers;
  const partyLoading =
    kind.type === "sales" ? customersLoading : jobWorkersLoading;

  useEffect(() => {
    // Masters refreshers throw offline — the editor still works from cache.
    void refreshCustomers().catch(() => {});
    void refreshJobWorkers().catch(() => {});
    void refreshDeniers().catch(() => {});
    void refreshColors().catch(() => {});
  }, [refreshCustomers, refreshJobWorkers, refreshDeniers, refreshColors]);

  useEffect(() => {
    if (isEdit && id && !prefilled.current)
      void load(id).catch((err) => {
        setError(
          err instanceof Error
            ? friendlyError(err)
            : "Could not load the challan.",
        );
      });
  }, [isEdit, id, load]);

  useEffect(() => {
    if (!isEdit) return;
    prefilled.current = false;
    pendingFocus.current = null;
  }, [isEdit, id]);

  useEffect(() => clearDetail, [clearDetail]);

  useEffect(() => {
    if (!isEdit || !detail || prefilled.current) return;
    prefilled.current = true;
    const c = detail.challan;
    setDate(c.date);
    setPartyId(
      kind.type === "sales" ? (c.customerId ?? "") : (c.jobWorkerId ?? ""),
    );
    setNotes(c.notes ?? "");
    setRows(
      detail.items.length
        ? detail.items.map((i) => ({
            key: i.id,
            boxNo: i.boxNo,
            cheese: String(i.cheese || ""),
            grossWt: String(i.grossWt || ""),
            tareWt: String(i.tareWt || ""),
            lotNo: i.lotNo,
            remarks: i.remarks,
            denierId: i.denierId,
            colorId: i.colorId ?? "",
            netWt: String(i.netWt),
            boxes: String(i.boxes || 1),
          }))
        : [emptyRow()],
    );
    setDirty(false);
  }, [isEdit, detail, kind.type]);

  useLayoutEffect(() => {
    if (pendingFocus.current) {
      const { i, field } = pendingFocus.current;
      pendingFocus.current = null;
      itemRefs.current[i]?.[field]?.focus();
    }
  });

  const setFieldRef =
    (i: number, field: string) =>
    (el: HTMLInputElement | HTMLButtonElement | null) => {
      if (!itemRefs.current[i]) itemRefs.current[i] = {};
      if (el) itemRefs.current[i]![field] = el;
      else delete itemRefs.current[i]?.[field];
    };

  const focusAfterRender = (i: number, field: string) => {
    pendingFocus.current = { i, field };
  };

  const updateRow = (i: number, patch: Partial<ItemRow>) => {
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    );
    setDirty(true);
  };

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow()]);
    setDirty(true);
  };

  const removeRow = (i: number) => {
    setRows((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i),
    );
    setDirty(true);
  };

  // Warn before closing/reloading the tab with uncommitted edits (browsers
  // show a native confirm — the SPA's own Cancel button runs onCancel below).
  useDirtyGuard(dirty);

  const onCancel = async () => {
    const target = isEdit && id ? `${kind.listPath}/${id}` : kind.listPath;
    if (!dirty) {
      navigate(target);
      return;
    }
    const ok = await confirm({
      title: "Discard unsaved changes?",
      description: "Edits to this challan haven't been saved yet.",
      confirmLabel: "Discard",
      destructive: true,
    });
    if (ok) navigate(target);
  };

  const handleKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    i: number,
    field: string,
  ) => {
    const last = i === rows.length - 1;
    if (e.key === "Enter") {
      e.preventDefault();
      if (last) {
        const next = rows.length;
        addRow();
        focusAfterRender(next, "boxNo");
      } else {
        itemRefs.current[i + 1]?.[field]?.focus();
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (last) {
        const next = rows.length;
        addRow();
        focusAfterRender(next, field);
      } else {
        itemRefs.current[i + 1]?.[field]?.focus();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (i > 0) itemRefs.current[i - 1]?.[field]?.focus();
    } else if (
      e.key === "Delete" &&
      rows.length > 1 &&
      e.currentTarget.value === ""
    ) {
      e.preventDefault();
      removeRow(i);
      focusAfterRender(Math.max(i - 1, 0), field);
    }
  };

  const totals = (() => {
    let boxes = 0;
    let cheese = 0;
    let grossWt = 0;
    let tareWt = 0;
    let netWt = 0;
    for (const r of rows) {
      const c = parseInt(r.cheese, 10);
      const gross = parseFloat(r.grossWt);
      const tare = parseFloat(r.tareWt);
      const n = parseFloat(r.netWt);
      if (!Number.isFinite(n) || n <= 0) continue;
      boxes += Math.max(1, parseInt(r.boxes, 10) || 1);
      cheese += Number.isFinite(c) && c > 0 ? c : 0;
      grossWt += Number.isFinite(gross) && gross > 0 ? gross : 0;
      tareWt += Number.isFinite(tare) && tare > 0 ? tare : 0;
      netWt += n;
    }
    return { boxes, cheese, grossWt, tareWt, netWt };
  })();

  const onSave = async () => {
    if (!partyId) {
      setError(`Select a ${kind.party.toLowerCase()}.`);
      return;
    }
    const items = rows.map((r) => ({
      denierId: r.denierId,
      colorId: r.colorId,
      boxNo: r.boxNo.trim(),
      lotNo: r.lotNo.trim(),
      cheese: Math.max(0, parseInt(r.cheese, 10) || 0),
      grossWt: Math.max(0, parseFloat(r.grossWt) || 0),
      tareWt: Math.max(0, parseFloat(r.tareWt) || 0),
      remarks: r.remarks.trim(),
      boxes: Math.max(1, parseInt(r.boxes, 10) || 1),
      netWt: parseFloat(r.netWt),
    }));
    if (
      items.some((i) => !i.denierId || (kind.type === "sales" && !i.colorId))
    ) {
      setError(
        kind.type === "sales"
          ? "Every row needs a denier and a color."
          : "Every row needs a denier.",
      );
      return;
    }
    if (items.some((i) => !Number.isFinite(i.netWt) || i.netWt <= 0)) {
      setError("Every row needs a net weight above 0.");
      return;
    }
    const input: ChallanInput = {
      type: kind.type,
      date,
      notes,
      items,
      ...(kind.type === "sales"
        ? { customerId: partyId }
        : { jobWorkerId: partyId }),
    };
    setError(null);
    setSaving(true);
    try {
      const saved =
        isEdit && id ? await update(id, input) : await create(input);
      setDirty(false);
      navigate(`${kind.listPath}/${saved.id}`);
    } catch (err) {
      setError(friendlyError(err, "Something went wrong."));
      setSaving(false);
    }
  };

  const newLabel = kind.type === "sales" ? "sales challan" : "job-work challan";

  const handleImport = (items: PackingItem[]) => {
    const mapped: ItemRow[] = items.map((it) => ({
      key: crypto.randomUUID(),
      boxNo: it.boxNo ?? "",
      cheese: it.cones ? String(it.cones) : "",
      grossWt: "",
      tareWt: "",
      netWt: String(it.netWt),
      boxes: "1",
      denierId: it.denierId ?? "",
      colorId: it.colorId ?? "",
      lotNo: it.lotNo ?? "",
      remarks: "",
    }));
    setRows((prev) => {
      const isEmptySingle =
        prev.length === 1 &&
        !prev[0].denierId &&
        !prev[0].colorId &&
        !prev[0].netWt &&
        !prev[0].boxNo;
      return isEmptySingle ? mapped : [...prev, ...mapped];
    });
    setDirty(true);
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow={isEdit ? "Update record" : "Create dispatch note"}
        title={isEdit ? `Edit ${newLabel}` : `New ${newLabel}`}
        description={`${company?.name ?? "Company"} · number assigned when saved`}
        actions={
          <div className="hidden items-center gap-2 sm:flex">
            <Button variant="outline" onClick={() => void onCancel()}>
              Cancel
            </Button>
            <Button
              onClick={() => void onSave()}
              loading={saving}
              className="min-w-36"
            >
              <Save aria-hidden />
              Save challan
            </Button>
          </div>
        }
      />

      {error && (
        <p className="mt-4 rounded-lg border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-6">
        <Card className="h-fit overflow-hidden sm:max-w-[640px]">
          <CardHeader className="border-b border-border bg-muted px-4 py-3">
            <p className="page-eyebrow">Step 1</p>
            <CardTitle className="mt-1 text-[15px]">Challan details</CardTitle>
            <CardDescription className="text-xs">
              Set the issue date and recipient.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel
                  htmlFor="challan-date"
                  className="text-xs font-semibold"
                >
                  Date
                </FieldLabel>
                <DatePicker
                  id="challan-date"
                  value={date}
                  maxDate="2100-12-31"
                  onChange={(d) => {
                    setDate(d);
                    setDirty(true);
                  }}
                />
              </Field>
              <Field>
                <FieldLabel
                  htmlFor="challan-party"
                  className="text-xs font-semibold"
                >
                  {kind.party}
                </FieldLabel>
                <Select
                  value={partyId}
                  onValueChange={(v) => {
                    setPartyId(v);
                    setDirty(true);
                  }}
                >
                  <SelectTrigger id="challan-party" className="h-11 sm:h-10">
                    <SelectValue
                      placeholder={
                        partyLoading
                          ? "Loading…"
                          : `Select ${kind.party.toLowerCase()}…`
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {partyLoading ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        Loading…
                      </div>
                    ) : parties.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No {kind.party.toLowerCase()} yet. Add one from Masters.
                      </div>
                    ) : (
                      parties.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel
                  htmlFor="challan-notes"
                  className="text-xs font-semibold"
                >
                  Notes
                </FieldLabel>
                <Textarea
                  id="challan-notes"
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    setDirty(true);
                  }}
                  rows={2}
                  maxLength={500}
                  placeholder="Optional remarks shown on the challan."
                  className="min-h-[44px] resize-none"
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card className="overflow-hidden flex flex-col">
          <CardHeader className="border-b border-border bg-muted px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="page-eyebrow">Step 2</p>
                <CardTitle className="mt-1 text-[15px]">Line items</CardTitle>
                <CardDescription className="text-xs">
                  One row per box. Weights, yarn & lot reference.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {kind.type === "sales" && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setImportOpen(true)}
                  >
                    <Download className="size-3.5" />
                    <span>Import</span>
                    <span className="hidden sm:inline">from Packing</span>
                  </Button>
                )}
                <Badge
                  variant="secondary"
                  className="font-semibold tabular-nums"
                >
                  {rows.length} {rows.length === 1 ? "line" : "lines"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 pb-4 flex-1">
            <div className="lg:overflow-x-auto">
              <div className="lg:min-w-[1080px]">
                {/* Desktop header — full width now that Step1/Step2 are stacked */}
                <div className="hidden lg:grid grid-cols-[48px_96px_76px_96px_96px_96px_76px_minmax(0,1fr)_minmax(0,1fr)_96px_minmax(0,1fr)_36px] gap-2 border-x border-transparent px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  <span className="text-center">Sr.</span>
                  <span>
                    {kind.type === "outward" ? "Sack no." : "Box no."}
                  </span>
                  <span>{kind.type === "outward" ? "Cones" : "Cheese"}</span>
                  <span>Gross</span>
                  <span>Tare</span>
                  <span>Net</span>
                  <span>{kind.type === "outward" ? "Sacks" : "Boxes"}</span>
                  <span>Denier</span>
                  <span>
                    {kind.type === "outward" ? "Colour (Opt)" : "Colour"}
                  </span>
                  <span>Lot</span>
                  <span>Remarks</span>
                  <span />
                </div>

                <div className="flex flex-col gap-3">
                  <AnimatePresence initial={false}>
                    {rows.map((r, i) => (
                      <motion.div
                        key={r.key}
                        layout={!reduceMotion}
                        initial={
                          reduceMotion
                            ? false
                            : { opacity: 0, y: -8, scale: 0.98 }
                        }
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={
                          reduceMotion
                            ? { duration: 0 }
                            : { duration: 0.18, ease: EASE }
                        }
                      >
                        {/* Mobile / Tablet card (<lg) */}
                        <div className="lg:hidden rounded-lg border border-border bg-card p-3.5">
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-2 text-xs font-bold">
                              <span className="grid size-7 place-items-center rounded-md bg-muted text-muted-foreground text-xs">
                                {i + 1}
                              </span>
                              <span className="text-muted-foreground">
                                Line {i + 1}
                              </span>
                              {parseFloat(r.netWt) > 0 && (
                                <span className="rounded-sm bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                                  {r.netWt} kg
                                </span>
                              )}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeRow(i)}
                              disabled={rows.length <= 1}
                              aria-label={`Remove row ${i + 1}`}
                              className="size-8 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                            >
                              <X className="size-4" aria-hidden />
                            </Button>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2.5">
                            <Field className="gap-1.5">
                              <FieldLabel className="text-[11px] font-semibold">
                                {kind.type === "outward"
                                  ? "Sack no."
                                  : "Box no."}
                              </FieldLabel>
                              <Input
                                value={r.boxNo}
                                placeholder={
                                  kind.type === "outward" ? "S-001" : "B-001"
                                }
                                onChange={(e) =>
                                  updateRow(i, { boxNo: e.target.value })
                                }
                                onKeyDown={(e) => handleKeyDown(e, i, "boxNo")}
                                ref={setFieldRef(i, "boxNo")}
                                className="h-11 sm:h-10"
                              />
                            </Field>
                            <Field className="gap-1.5">
                              <FieldLabel className="text-[11px] font-semibold">
                                {kind.type === "outward" ? "Cones" : "Cheese"}
                              </FieldLabel>
                              <Input
                                type="number"
                                min={0}
                                inputMode="numeric"
                                value={r.cheese}
                                placeholder="0"
                                onChange={(e) =>
                                  updateRow(i, { cheese: e.target.value })
                                }
                                onKeyDown={(e) => handleKeyDown(e, i, "cheese")}
                                ref={setFieldRef(i, "cheese")}
                                className="h-11 sm:h-10"
                              />
                            </Field>
                            <Field className="gap-1.5">
                              <FieldLabel className="text-[11px] font-semibold">
                                Gross wt.
                              </FieldLabel>
                              <Input
                                type="number"
                                min={0}
                                step="0.001"
                                inputMode="decimal"
                                value={r.grossWt}
                                placeholder="0.000"
                                onChange={(e) =>
                                  updateRow(i, { grossWt: e.target.value })
                                }
                                onKeyDown={(e) =>
                                  handleKeyDown(e, i, "grossWt")
                                }
                                ref={setFieldRef(i, "grossWt")}
                                className="h-11 sm:h-10"
                              />
                            </Field>
                            <Field className="gap-1.5">
                              <FieldLabel className="text-[11px] font-semibold">
                                Tare wt.
                              </FieldLabel>
                              <Input
                                type="number"
                                min={0}
                                step="0.001"
                                inputMode="decimal"
                                value={r.tareWt}
                                placeholder="0.000"
                                onChange={(e) =>
                                  updateRow(i, { tareWt: e.target.value })
                                }
                                onKeyDown={(e) => handleKeyDown(e, i, "tareWt")}
                                ref={setFieldRef(i, "tareWt")}
                                className="h-11 sm:h-10"
                              />
                            </Field>
                            <Field className="gap-1.5">
                              <FieldLabel className="text-[11px] font-semibold">
                                Net wt. *
                              </FieldLabel>
                              <Input
                                type="number"
                                min={0}
                                step="0.001"
                                inputMode="decimal"
                                value={r.netWt}
                                placeholder="0.000"
                                onChange={(e) =>
                                  updateRow(i, { netWt: e.target.value })
                                }
                                onKeyDown={(e) => handleKeyDown(e, i, "netWt")}
                                ref={setFieldRef(i, "netWt")}
                                className="h-11 sm:h-10 font-semibold"
                              />
                            </Field>
                            <Field className="gap-1.5">
                              <FieldLabel className="text-[11px] font-semibold">
                                Boxes
                              </FieldLabel>
                              <Input
                                type="number"
                                min={1}
                                step={1}
                                inputMode="numeric"
                                value={r.boxes}
                                placeholder="1"
                                onChange={(e) =>
                                  updateRow(i, { boxes: e.target.value })
                                }
                                onKeyDown={(e) => handleKeyDown(e, i, "boxes")}
                                ref={setFieldRef(i, "boxes")}
                                className="h-11 sm:h-10"
                              />
                            </Field>
                          </div>

                          <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                            <Field className="gap-1.5">
                              <FieldLabel className="text-[11px] font-semibold">
                                Denier *
                              </FieldLabel>
                              <Select
                                value={r.denierId}
                                onValueChange={(v) =>
                                  updateRow(i, { denierId: v })
                                }
                              >
                                <SelectTrigger
                                  ref={setFieldRef(i, "denier")}
                                  className="h-11 sm:h-10"
                                >
                                  <SelectValue placeholder="Denier…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {deniersLoading ? (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">
                                      Loading…
                                    </div>
                                  ) : deniers.length === 0 ? (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">
                                      Add from Masters.
                                    </div>
                                  ) : (
                                    deniers.map((d) => (
                                      <SelectItem key={d.id} value={d.id}>
                                        {d.name}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            </Field>
                            <Field className="gap-1.5">
                              <FieldLabel className="text-[11px] font-semibold">
                                {kind.type === "outward"
                                  ? "Colour (optional)"
                                  : "Colour *"}
                              </FieldLabel>
                              <Select
                                value={r.colorId}
                                onValueChange={(v) =>
                                  updateRow(i, { colorId: v })
                                }
                              >
                                <SelectTrigger
                                  ref={setFieldRef(i, "color")}
                                  className="h-11 sm:h-10"
                                >
                                  <SelectValue
                                    placeholder={
                                      kind.type === "outward"
                                        ? "Colour (optional)…"
                                        : "Colour…"
                                    }
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {colorsLoading ? (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">
                                      Loading…
                                    </div>
                                  ) : colors.length === 0 ? (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">
                                      Add from Masters.
                                    </div>
                                  ) : (
                                    colors.map((c) => (
                                      <SelectItem key={c.id} value={c.id}>
                                        {c.code
                                          ? `${c.code} · ${c.name}`
                                          : c.name}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            </Field>
                          </div>

                          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                            <Field className="gap-1.5">
                              <FieldLabel className="text-[11px] font-semibold">
                                Lot no.
                              </FieldLabel>
                              <Input
                                value={r.lotNo}
                                placeholder="Lot"
                                onChange={(e) =>
                                  updateRow(i, { lotNo: e.target.value })
                                }
                                onKeyDown={(e) => handleKeyDown(e, i, "lotNo")}
                                ref={setFieldRef(i, "lotNo")}
                                className="h-11 sm:h-10"
                              />
                            </Field>
                            <Field className="gap-1.5">
                              <FieldLabel className="text-[11px] font-semibold">
                                Remarks
                              </FieldLabel>
                              <Input
                                value={r.remarks}
                                placeholder="Optional"
                                onChange={(e) =>
                                  updateRow(i, { remarks: e.target.value })
                                }
                                onKeyDown={(e) =>
                                  handleKeyDown(e, i, "remarks")
                                }
                                ref={setFieldRef(i, "remarks")}
                                className="h-11 sm:h-10"
                              />
                            </Field>
                          </div>
                        </div>

                        {/* Desktop grid — full width */}
                        <div className="hidden lg:grid grid-cols-[48px_96px_76px_96px_96px_96px_76px_minmax(0,1fr)_minmax(0,1fr)_96px_minmax(0,1fr)_36px] gap-2 rounded-md border border-border bg-muted/20 p-2 items-center transition-colors hover:bg-card">
                          <span className="text-center text-sm font-semibold tabular-nums text-muted-foreground">
                            {i + 1}
                          </span>
                          <Input
                            value={r.boxNo}
                            placeholder={
                              kind.type === "outward" ? "S-001" : "B-001"
                            }
                            onChange={(e) =>
                              updateRow(i, { boxNo: e.target.value })
                            }
                            onKeyDown={(e) => handleKeyDown(e, i, "boxNo")}
                            ref={setFieldRef(i, "boxNo")}
                            aria-label={`Row ${i + 1} box`}
                            className="h-11 sm:h-10 text-sm"
                          />
                          <Input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={r.cheese}
                            placeholder="0"
                            onChange={(e) =>
                              updateRow(i, { cheese: e.target.value })
                            }
                            onKeyDown={(e) => handleKeyDown(e, i, "cheese")}
                            ref={setFieldRef(i, "cheese")}
                            aria-label={`Row ${i + 1} cheese`}
                            className="h-11 sm:h-10"
                          />
                          <Input
                            type="number"
                            min={0}
                            step="0.001"
                            inputMode="decimal"
                            value={r.grossWt}
                            placeholder="0.000"
                            onChange={(e) =>
                              updateRow(i, { grossWt: e.target.value })
                            }
                            onKeyDown={(e) => handleKeyDown(e, i, "grossWt")}
                            ref={setFieldRef(i, "grossWt")}
                            aria-label={`Row ${i + 1} gross`}
                            className="h-11 sm:h-10"
                          />
                          <Input
                            type="number"
                            min={0}
                            step="0.001"
                            inputMode="decimal"
                            value={r.tareWt}
                            placeholder="0.000"
                            onChange={(e) =>
                              updateRow(i, { tareWt: e.target.value })
                            }
                            onKeyDown={(e) => handleKeyDown(e, i, "tareWt")}
                            ref={setFieldRef(i, "tareWt")}
                            aria-label={`Row ${i + 1} tare`}
                            className="h-11 sm:h-10"
                          />
                          <Input
                            type="number"
                            min={0}
                            step="0.001"
                            inputMode="decimal"
                            value={r.netWt}
                            placeholder="0.000"
                            onChange={(e) =>
                              updateRow(i, { netWt: e.target.value })
                            }
                            onKeyDown={(e) => handleKeyDown(e, i, "netWt")}
                            ref={setFieldRef(i, "netWt")}
                            aria-label={`Row ${i + 1} net`}
                            className="h-11 sm:h-10 font-medium"
                          />
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            inputMode="numeric"
                            value={r.boxes}
                            placeholder="1"
                            onChange={(e) =>
                              updateRow(i, { boxes: e.target.value })
                            }
                            onKeyDown={(e) => handleKeyDown(e, i, "boxes")}
                            ref={setFieldRef(i, "boxes")}
                            aria-label={`Row ${i + 1} boxes`}
                            className="h-11 sm:h-10"
                          />
                          <Select
                            value={r.denierId}
                            onValueChange={(v) => updateRow(i, { denierId: v })}
                          >
                            <SelectTrigger
                              ref={setFieldRef(i, "denier")}
                              className="h-11 sm:h-10 px-2.5 text-xs"
                            >
                              <SelectValue placeholder="Denier…" />
                            </SelectTrigger>
                            <SelectContent>
                              {deniersLoading ? (
                                <div className="px-3 py-2 text-sm text-muted-foreground">
                                  Loading…
                                </div>
                              ) : deniers.length === 0 ? (
                                <div className="px-3 py-2 text-sm text-muted-foreground">
                                  Add from Masters.
                                </div>
                              ) : (
                                deniers.map((d) => (
                                  <SelectItem key={d.id} value={d.id}>
                                    {d.name}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <Select
                            value={r.colorId}
                            onValueChange={(v) => updateRow(i, { colorId: v })}
                          >
                            <SelectTrigger
                              ref={setFieldRef(i, "color")}
                              className="h-11 sm:h-10 px-2.5 text-xs"
                            >
                              <SelectValue
                                placeholder={
                                  kind.type === "outward"
                                    ? "Colour (opt)…"
                                    : "Colour…"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {colorsLoading ? (
                                <div className="px-3 py-2 text-sm text-muted-foreground">
                                  Loading…
                                </div>
                              ) : colors.length === 0 ? (
                                <div className="px-3 py-2 text-sm text-muted-foreground">
                                  Add from Masters.
                                </div>
                              ) : (
                                colors.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.code ? `${c.code} · ${c.name}` : c.name}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <Input
                            value={r.lotNo}
                            placeholder="Lot"
                            onChange={(e) =>
                              updateRow(i, { lotNo: e.target.value })
                            }
                            onKeyDown={(e) => handleKeyDown(e, i, "lotNo")}
                            ref={setFieldRef(i, "lotNo")}
                            aria-label={`Row ${i + 1} lot`}
                            className="h-11 sm:h-10 text-xs"
                          />
                          <Input
                            value={r.remarks}
                            placeholder="—"
                            onChange={(e) =>
                              updateRow(i, { remarks: e.target.value })
                            }
                            onKeyDown={(e) => handleKeyDown(e, i, "remarks")}
                            ref={setFieldRef(i, "remarks")}
                            aria-label={`Row ${i + 1} remarks`}
                            className="h-11 sm:h-10 text-xs"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRow(i)}
                            disabled={rows.length <= 1}
                            aria-label={`Remove row ${i + 1}`}
                            className="size-8 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <X className="size-4" aria-hidden />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              className="mt-4 w-full border-dashed sm:w-auto"
              onClick={addRow}
            >
              <Plus aria-hidden />
              Add item
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardContent className="grid gap-0 p-0 sm:grid-cols-3">
          <div className="border-b border-border px-5 py-4 sm:border-b-0 sm:border-r">
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Total boxes
            </div>
            <div className="mt-1 text-xl font-bold tracking-tight tabular-nums">
              {fmtBoxes(totals.boxes)}
            </div>
          </div>
          <div className="border-b border-border px-5 py-4 sm:border-b-0 sm:col-span-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Net weight
            </div>
            <div className="mt-1 text-xl font-bold tracking-tight tabular-nums">
              {fmtWt(totals.netWt)}{" "}
              <span className="text-sm font-semibold text-muted-foreground">
                kg
              </span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {totals.cheese > 0 ? `${totals.cheese} cheese` : ""}
              {totals.grossWt > 0 ? ` • ${fmtWt(totals.grossWt)} gross` : ""}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sticky action bar — mobile only */}
      <div className="sticky-action-bar mt-6 flex gap-2 sm:hidden">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => void onCancel()}
        >
          Cancel
        </Button>
        <Button
          onClick={() => void onSave()}
          loading={saving}
          className="flex-1"
        >
          <Save aria-hidden />
          Save
        </Button>
      </div>

      {/* Desktop save duplicate hidden on mobile already shown top */}
      <div className="hidden sm:flex gap-2 mt-6 justify-end">
        <Button variant="outline" onClick={() => void onCancel()}>
          Cancel
        </Button>
        <Button
          onClick={() => void onSave()}
          loading={saving}
          className="min-w-36"
        >
          <Save aria-hidden />
          Save challan
        </Button>
      </div>

      <PackingImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleImport}
      />

      {dialog}
    </AppShell>
  );
}

// ── Detail ───────────────────────────────────────────────────────────────────
