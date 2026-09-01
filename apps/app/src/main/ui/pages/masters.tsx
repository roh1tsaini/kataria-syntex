import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Factory,
  Layers,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { usePermission } from "@/store/auth";
import {
  useMasters,
  type Customer,
  type CustomerInput,
  type Denier,
  type DenierInput,
  type JobWorker,
  type JobWorkerInput,
  type Supplier,
  type SupplierInput,
} from "@/store/masters";
import { friendlyError } from "@/ui/lib/errors";
import { toastError, toastSuccess } from "@/store/toast";
import { AppShell } from "@/ui/components/app-shell";
import { PageHeader } from "@/ui/components/page-header";
import { Button } from "@/ui/components/ui/button";
import { Input } from "@/ui/components/ui/input";
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
import { Card, CardContent } from "@/ui/components/ui/card";
import { Badge } from "@/ui/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/ui/components/ui/tabs";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/components/ui/select";

const TABS = [
  { key: "customers", label: "Customers", icon: Users },
  { key: "jobWorkers", label: "Job workers", icon: Factory },
  { key: "deniers", label: "Deniers", icon: Layers },
  { key: "suppliers", label: "Suppliers", icon: Truck },
] as const;

type TabKey = (typeof TABS)[number]["key"];

type FieldDef = {
  key: string;
  label: string;
  placeholder: string;
  type?: "tel" | "select";
  maxLength?: number;
  options?: { value: string; label: string }[];
};

type TabConfig<I, In> = {
  items: I[];
  loading: boolean;
  refresh: () => Promise<void>;
  create: (input: In) => Promise<void>;
  update: (id: string, input: In) => Promise<void>;
  remove: (id: string) => Promise<void>;
  fields: FieldDef[];
  draftFromItem: (item: I | null) => Record<string, string>;
  draftToInput: (draft: Record<string, string>) => In;
  meta: (item: I) => string;
  empty: string;
  singular: string;
  icon: LucideIcon;
};

function MasterFormDialog<I extends { id: string }, In>({
  config,
  open,
  editing,
  onOpenChange,
}: {
  config: TabConfig<I, In>;
  open: boolean;
  editing: I | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    config.draftFromItem(editing),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const input = config.draftToInput(draft);
      if (editing) {
        await config.update(editing.id, input);
        toastSuccess(
          `${config.singular.charAt(0).toUpperCase()}${config.singular.slice(1)} updated`,
        );
      } else {
        await config.create(input);
        toastSuccess(
          `${config.singular.charAt(0).toUpperCase()}${config.singular.slice(1)} added`,
        );
      }
      onOpenChange(false);
    } catch (err) {
      const msg = friendlyError(err);
      setError(msg);
      toastError("Could not save", msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? `Edit ${config.singular}` : `Add ${config.singular}`}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the details and save."
              : "Fill in the details; name is required."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FieldGroup className="gap-4">
            {config.fields.map((f) =>
              f.type === "select" && f.options ? (
                <Field key={f.key}>
                  <FieldLabel htmlFor={`f-${f.key}`}>{f.label}</FieldLabel>
                  <Select
                    value={draft[f.key] ?? f.options[0]?.value ?? ""}
                    onValueChange={(v) =>
                      setDraft((d) => ({ ...d, [f.key]: v }))
                    }
                  >
                    <SelectTrigger id={`f-${f.key}`}>
                      <SelectValue placeholder={f.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {f.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : (
                <Field key={f.key}>
                  <FieldLabel htmlFor={`f-${f.key}`}>{f.label}</FieldLabel>
                  <Input
                    id={`f-${f.key}`}
                    type={f.type === "tel" ? "tel" : "text"}
                    maxLength={f.maxLength}
                    required={f.key === "name"}
                    value={draft[f.key] ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [f.key]: e.target.value }))
                    }
                    placeholder={f.placeholder}
                  />
                </Field>
              ),
            )}
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={!draft.name?.trim()}>
              {editing ? "Save changes" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MasterTab<I extends { id: string; name: string }, In>({
  config,
  canManage,
  label,
}: {
  config: TabConfig<I, In>;
  canManage: boolean;
  label: string;
}) {
  const [q, setQ] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<I | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    void config.refresh().catch((err) => setError(friendlyError(err)));
  }, [config.refresh]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return config.items;
    return config.items.filter((i) => i.name.toLowerCase().includes(needle));
  }, [config.items, q]);

  const onDelete = async (item: I) => {
    setError(null);
    const ok = await confirm({
      title: `Delete "${item.name}"?`,
      description:
        "This cannot be undone. Existing challans keep their own copy of the name.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    setDeletingId(item.id);
    try {
      await config.remove(item.id);
      toastSuccess(`${item.name} deleted`);
    } catch (err) {
      const msg = friendlyError(err);
      setError(msg);
      toastError("Could not delete", msg);
    } finally {
      setDeletingId(null);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  return (
    <div>
      <div className="filter-bar">
        <div className="w-full min-w-0 flex-1 sm:max-w-[420px]">
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <Search className="size-4 text-muted-foreground" aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              aria-label={`Search ${label.toLowerCase()}`}
            />
          </InputGroup>
        </div>
        {canManage && (
          <Button className="ml-auto w-full sm:w-auto" onClick={openAdd}>
            <Plus aria-hidden />
            Add {config.singular}
          </Button>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card className="mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {label}
          </span>
          <Badge
            variant="secondary"
            className="font-medium tabular-nums whitespace-nowrap"
          >
            {config.loading && config.items.length === 0
              ? "Loading…"
              : q.trim()
                ? `${filtered.length} of ${config.items.length}`
                : `${config.items.length} ${config.items.length === 1 ? "record" : "records"}`}
          </Badge>
        </div>
        <CardContent className="p-0">
          {config.loading && config.items.length === 0 ? (
            <div aria-hidden className="divide-y divide-border/60">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-3 sm:px-5"
                >
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                  <Skeleton className="h-8 w-24 rounded-md" />
                </div>
              ))}
            </div>
          ) : config.items.length === 0 ? (
            <Empty className="px-4 py-10">
              <EmptyMedia variant="icon">
                <config.icon className="size-5" aria-hidden />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>No {label.toLowerCase()} yet</EmptyTitle>
                <EmptyDescription>{config.empty}</EmptyDescription>
              </EmptyHeader>
              {canManage && (
                <EmptyContent>
                  <Button onClick={openAdd}>
                    <Plus aria-hidden />
                    Add {config.singular}
                  </Button>
                </EmptyContent>
              )}
            </Empty>
          ) : filtered.length === 0 ? (
            <Empty className="px-4 py-10">
              <EmptyMedia variant="icon">
                <Search className="size-5" aria-hidden />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>Nothing matches “{q}”</EmptyTitle>
                <EmptyDescription>
                  Try a different name or clear the search.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div>
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 border-b border-border/65 px-4 py-2.5 transition-colors last:border-b-0 hover:bg-muted/40 sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {item.name}
                    </div>
                    {config.meta(item) && (
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {config.meta(item)}
                      </div>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(item);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="size-4" aria-hidden />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={deletingId === item.id}
                        onClick={() => void onDelete(item)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {dialog}

      <MasterFormDialog
        key={`${editing?.id ?? "new"}-${dialogOpen}`}
        config={config}
        open={dialogOpen}
        editing={editing}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
      />
    </div>
  );
}

export function MastersPage() {
  const canManage = usePermission()("manage_masters");

  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get("tab");
  const tab: TabKey = TABS.some((t) => t.key === tabParam)
    ? (tabParam as TabKey)
    : "customers";

  const selectTab = (key: TabKey) => {
    setSearchParams(key === "customers" ? {} : { tab: key });
  };

  const customers = useMasters((s) => s.customers);
  const customersLoading = useMasters((s) => s.customersLoading);
  const jobWorkers = useMasters((s) => s.jobWorkers);
  const jobWorkersLoading = useMasters((s) => s.jobWorkersLoading);
  const deniers = useMasters((s) => s.deniers);
  const deniersLoading = useMasters((s) => s.deniersLoading);
  const suppliers = useMasters((s) => s.suppliers);
  const suppliersLoading = useMasters((s) => s.suppliersLoading);
  const refreshCustomers = useMasters((s) => s.refreshCustomers);
  const refreshJobWorkers = useMasters((s) => s.refreshJobWorkers);
  const refreshDeniers = useMasters((s) => s.refreshDeniers);
  const refreshSuppliers = useMasters((s) => s.refreshSuppliers);
  const createCustomer = useMasters((s) => s.createCustomer);
  const createJobWorker = useMasters((s) => s.createJobWorker);
  const createDenier = useMasters((s) => s.createDenier);
  const createSupplier = useMasters((s) => s.createSupplier);
  const updateCustomer = useMasters((s) => s.updateCustomer);
  const updateJobWorker = useMasters((s) => s.updateJobWorker);
  const updateDenier = useMasters((s) => s.updateDenier);
  const updateSupplier = useMasters((s) => s.updateSupplier);
  const deleteCustomer = useMasters((s) => s.deleteCustomer);
  const deleteJobWorker = useMasters((s) => s.deleteJobWorker);
  const deleteDenier = useMasters((s) => s.deleteDenier);
  const deleteSupplier = useMasters((s) => s.deleteSupplier);

  const customerConfig: TabConfig<Customer, CustomerInput> = {
    items: customers,
    loading: customersLoading,
    refresh: refreshCustomers,
    create: createCustomer,
    update: updateCustomer,
    remove: deleteCustomer,
    singular: "customer",
    icon: Users,
    empty: "No customers yet. Add your first customer.",
    fields: [
      {
        key: "name",
        label: "Name",
        placeholder: "Customer name",
        maxLength: 120,
      },
      {
        key: "phone",
        label: "Phone",
        placeholder: "10-digit mobile number",
        type: "tel",
        maxLength: 20,
      },
      {
        key: "address",
        label: "Address",
        placeholder: "Full address",
        maxLength: 300,
      },
      {
        key: "gstin",
        label: "GSTIN",
        placeholder: "15-character GSTIN",
        maxLength: 15,
      },
    ],
    draftFromItem: (i) => ({
      name: i?.name ?? "",
      phone: i?.phone ?? "",
      address: i?.address ?? "",
      gstin: i?.gstin ?? "",
    }),
    draftToInput: (d) => ({
      name: d.name.trim(),
      phone: d.phone,
      address: d.address,
      gstin: d.gstin,
    }),
    meta: (i) => [i.phone, i.address, i.gstin].filter(Boolean).join(" · "),
  };

  const jobWorkerConfig: TabConfig<JobWorker, JobWorkerInput> = {
    items: jobWorkers,
    loading: jobWorkersLoading,
    refresh: refreshJobWorkers,
    create: createJobWorker,
    update: updateJobWorker,
    remove: deleteJobWorker,
    singular: "job worker",
    icon: Factory,
    empty: "No job workers yet. Add your first job worker.",
    fields: [
      {
        key: "name",
        label: "Name",
        placeholder: "Job worker name",
        maxLength: 120,
      },
      {
        key: "phone",
        label: "Phone",
        placeholder: "10-digit mobile number",
        type: "tel",
        maxLength: 20,
      },
      {
        key: "address",
        label: "Address",
        placeholder: "Full address",
        maxLength: 300,
      },
    ],
    draftFromItem: (i) => ({
      name: i?.name ?? "",
      phone: i?.phone ?? "",
      address: i?.address ?? "",
    }),
    draftToInput: (d) => ({
      name: d.name.trim(),
      phone: d.phone,
      address: d.address,
    }),
    meta: (i) => [i.phone, i.address].filter(Boolean).join(" · "),
  };

  const denierConfig: TabConfig<Denier, DenierInput> = {
    items: deniers,
    loading: deniersLoading,
    refresh: refreshDeniers,
    create: createDenier,
    update: updateDenier,
    remove: deleteDenier,
    singular: "denier",
    icon: Layers,
    empty: "No deniers yet. Add deniers like 20D, 30D, 40D.",
    fields: [
      { key: "name", label: "Denier", placeholder: "e.g. 20D", maxLength: 60 },
      {
        key: "description",
        label: "Description",
        placeholder: "Optional note",
        maxLength: 200,
      },
    ],
    draftFromItem: (i) => ({
      name: i?.name ?? "",
      description: i?.description ?? "",
    }),
    draftToInput: (d) => ({ name: d.name.trim(), description: d.description }),
    meta: (i) => i.description ?? "",
  };

  const supplierConfig: TabConfig<Supplier, SupplierInput> = {
    items: suppliers,
    loading: suppliersLoading,
    refresh: refreshSuppliers,
    create: createSupplier,
    update: updateSupplier,
    remove: deleteSupplier,
    singular: "supplier",
    icon: Truck,
    empty: "No suppliers yet. Add your first supplier.",
    fields: [
      {
        key: "name",
        label: "Name",
        placeholder: "Supplier name",
        maxLength: 120,
      },
      {
        key: "phone",
        label: "Phone",
        placeholder: "10-digit mobile number",
        type: "tel",
        maxLength: 20,
      },
      {
        key: "address",
        label: "Address",
        placeholder: "Full address",
        maxLength: 300,
      },
      {
        key: "gstin",
        label: "GSTIN",
        placeholder: "15-character GSTIN",
        maxLength: 15,
      },
    ],
    draftFromItem: (i) => ({
      name: i?.name ?? "",
      phone: i?.phone ?? "",
      address: i?.address ?? "",
      gstin: i?.gstin ?? "",
    }),
    draftToInput: (d) => ({
      name: d.name.trim(),
      phone: d.phone,
      address: d.address,
      gstin: d.gstin,
    }),
    meta: (i) => [i.phone, i.address, i.gstin].filter(Boolean).join(" · "),
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Reference data"
        title="Masters"
        description="Customers, job workers, suppliers and deniers used across your challans. Colors live in the Color Organiser."
      />

      <Tabs
        value={tab}
        onValueChange={(v) => selectTab(v as TabKey)}
        className="mt-6"
      >
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none scroll-fade">
          <TabsList className="w-max sm:w-auto">
            {TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>
                <t.icon className="size-4" aria-hidden />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="customers" className="mt-4">
          <MasterTab
            config={customerConfig}
            canManage={canManage}
            label="Customers"
          />
        </TabsContent>
        <TabsContent value="jobWorkers" className="mt-4">
          <MasterTab
            config={jobWorkerConfig}
            canManage={canManage}
            label="Job workers"
          />
        </TabsContent>
        <TabsContent value="deniers" className="mt-4">
          <MasterTab
            config={denierConfig}
            canManage={canManage}
            label="Deniers"
          />
        </TabsContent>
        <TabsContent value="suppliers" className="mt-4">
          <MasterTab
            config={supplierConfig}
            canManage={canManage}
            label="Suppliers"
          />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
