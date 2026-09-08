/**
 * Masters — the phone port of apps/app's pages/masters.tsx. Same four
 * registers (Customers / Job workers / Deniers / Suppliers) with search,
 * create/edit/delete, the same field sets and placeholders, in_use error
 * copy via friendlyError, and the manage_masters permission gate. Web's
 * radix tabs become a Pressable segmented control; the tab param lives in
 * the route (?tab=) exactly like web's search params.
 */

import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  friendlyError,
  toastError,
  toastSuccess,
  useMasters,
  usePermission,
  type Customer,
  type CustomerInput,
  type Denier,
  type DenierInput,
  type JobWorker,
  type JobWorkerInput,
  type Supplier,
  type SupplierInput,
} from "@kataria-syntex/app-core";
import { usePalette } from "@/theme";
import { Badge, Button, EmptyState, Field, Input, Skeleton } from "@/ui/kit";
import { confirm, requestDiscard } from "@/ui/confirm";

const TABS = [
  { key: "customers", label: "Customers", icon: "users" },
  { key: "jobWorkers", label: "Job workers", icon: "settings" },
  { key: "deniers", label: "Deniers", icon: "layers" },
  { key: "suppliers", label: "Suppliers", icon: "truck" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

type FieldDef = {
  key: string;
  label: string;
  placeholder: string;
  maxLength?: number;
  keyboardType?: "default" | "phone-pad";
};

type TabConfig<I extends { id: string; name: string }, In> = {
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
};

function MasterFormModal<I extends { id: string; name: string }, In>({
  config,
  open,
  editing,
  onClose,
}: {
  config: TabConfig<I, In>;
  open: boolean;
  editing: I | null;
  onClose: () => void;
}) {
  const p = usePalette();
  // Remounted per open (parent keys by item + open state), so the initial
  // draft is stable for the modal's lifetime — dirty is a shape compare.
  const [initial] = useState<Record<string, string>>(() =>
    config.draftFromItem(editing),
  );
  const [draft, setDraft] = useState<Record<string, string>>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const submit = async () => {
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
      onClose();
    } catch (err) {
      const msg = friendlyError(err);
      setError(msg);
      toastError("Could not save", msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={open}
      animationType="slide"
      onRequestClose={() => requestDiscard(dirty, busy, onClose)}
    >
      <View className="flex-1" style={{ backgroundColor: p.background }}>
        <View className="flex-row items-center justify-between px-4 pt-4">
          <Text
            className="min-w-0 flex-1 text-[17px] font-semibold"
            style={{ color: p.foreground }}
          >
            {editing ? `Edit ${config.singular}` : `Add ${config.singular}`}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => requestDiscard(dirty, busy, onClose)}
            className="min-h-[44px] justify-center px-3"
          >
            <Text className="text-[15px]" style={{ color: p.primary }}>
              Close
            </Text>
          </Pressable>
        </View>
        <Text className="px-4 text-[13px]" style={{ color: p.mutedForeground }}>
          {editing
            ? "Update the details and save."
            : "Fill in the details; name is required."}
        </Text>
        <ScrollView contentContainerClassName="gap-4 p-4 pb-8">
          {config.fields.map((f) => (
            <Field key={f.key} label={f.label}>
              <Input
                value={draft[f.key] ?? ""}
                maxLength={f.maxLength}
                keyboardType={
                  f.keyboardType === "phone-pad" ? "phone-pad" : "default"
                }
                onChangeText={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
                placeholder={f.placeholder}
                accessibilityLabel={f.label}
                aria-invalid={!!error}
              />
            </Field>
          ))}
          {error ? (
            <Text className="text-[12px]" style={{ color: p.destructive }}>
              {error}
            </Text>
          ) : null}
          <View className="mt-2 flex-row justify-end gap-2">
            <Button
              label="Cancel"
              variant="secondary"
              onPress={() => requestDiscard(dirty, busy, onClose)}
              disabled={busy}
            />
            <Button
              label={editing ? "Save changes" : "Add"}
              loading={busy}
              disabled={!draft.name?.trim()}
              onPress={() => void submit()}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
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
  const p = usePalette();
  const [q, setQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<I | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      description: "This cannot be undone, but challans keep their own copy.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    setDeletingId(item.id);
    try {
      await config.remove(item.id);
      toastSuccess(`${item.name} deleted`);
    } catch (err) {
      // in_use and friends arrive with friendly copy.
      const msg = friendlyError(err);
      setError(msg);
      toastError("Could not delete", msg);
    } finally {
      setDeletingId(null);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  return (
    <View className="flex-1">
      <View className="flex-row items-center gap-2 px-4 pt-4">
        <View className="min-w-0 flex-1">
          <Input
            value={q}
            onChangeText={setQ}
            placeholder={`Search ${label.toLowerCase()}…`}
            accessibilityLabel={`Search ${label.toLowerCase()}`}
            autoCapitalize="none"
          />
        </View>
        {canManage ? (
          <Button label={`Add ${config.singular}`} onPress={openAdd} />
        ) : null}
      </View>

      {error ? (
        <Text
          className="mx-4 mt-3 rounded-lg border px-4 py-3 text-sm"
          role="alert"
          style={{
            color: p.destructive,
            borderColor: `${p.destructive}33`,
            backgroundColor: `${p.destructive}14`,
          }}
        >
          {error}
        </Text>
      ) : null}

      <View className="flex-row items-center justify-between px-4 pb-1 pt-3">
        <Text
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: p.mutedForeground }}
        >
          {label}
        </Text>
        <Badge
          label={
            config.loading && config.items.length === 0
              ? "Loading…"
              : q.trim()
                ? `${filtered.length} of ${config.items.length}`
                : `${config.items.length} ${config.items.length === 1 ? "record" : "records"}`
          }
        />
      </View>

      <FlatList
        className="flex-1 px-4"
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerClassName="gap-2 pb-8"
        ListEmptyComponent={
          config.loading && config.items.length === 0 ? (
            <View className="gap-2 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <View
                  key={i}
                  className="flex-row items-center gap-3 rounded-xl border p-4"
                  style={{ backgroundColor: p.card, borderColor: p.border }}
                >
                  <View className="flex-1 gap-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </View>
                  <Skeleton className="h-8 w-24" />
                </View>
              ))}
            </View>
          ) : config.items.length === 0 ? (
            <View className="gap-3">
              <EmptyState
                title={`No ${label.toLowerCase()} yet`}
                message={config.empty}
              />
              {canManage ? (
                <Button label={`Add ${config.singular}`} onPress={openAdd} />
              ) : null}
            </View>
          ) : (
            <EmptyState
              title={`Nothing matches “${q}”`}
              message="Try a different name or clear the search."
            />
          )
        }
        renderItem={({ item }) => (
          <View
            className="flex-row items-center gap-1 rounded-xl border p-2"
            style={{ backgroundColor: p.card, borderColor: p.border }}
          >
            <View className="min-w-0 flex-1 px-2 py-1">
              <Text
                className="text-sm font-semibold"
                style={{ color: p.foreground }}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              {config.meta(item) ? (
                <Text
                  className="mt-0.5 text-xs"
                  style={{ color: p.mutedForeground }}
                  numberOfLines={1}
                >
                  {config.meta(item)}
                </Text>
              ) : null}
            </View>
            {canManage ? (
              <View className="flex-row shrink-0 items-center">
                <Button
                  label="Edit"
                  variant="ghost"
                  onPress={() => {
                    setEditing(item);
                    setModalOpen(true);
                  }}
                />
                <Button
                  label="Delete"
                  variant="ghost"
                  disabled={deletingId === item.id}
                  onPress={() => void onDelete(item)}
                />
              </View>
            ) : null}
          </View>
        )}
      />

      <MasterFormModal
        key={`${editing?.id ?? "new"}-${modalOpen}`}
        config={config}
        open={modalOpen}
        editing={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
      />
    </View>
  );
}

export default function MastersRoute() {
  const p = usePalette();
  const canManage = usePermission()("manage_masters");
  const router = useRouter();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();

  const tab: TabKey = TABS.some((t) => t.key === tabParam)
    ? (tabParam as TabKey)
    : "customers";

  const selectTab = (key: TabKey) => {
    router.setParams(key === "customers" ? { tab: "" } : { tab: key });
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
    empty: "Add your first customer.",
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
        keyboardType: "phone-pad",
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
    empty: "Add your first job worker.",
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
        keyboardType: "phone-pad",
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
    empty: "Add deniers like 20D, 30D, 40D.",
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
    empty: "Add your first supplier.",
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
        keyboardType: "phone-pad",
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
    <View className="flex-1" style={{ backgroundColor: p.background }}>
      <View className="px-4 pt-4">
        <Text
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: p.mutedForeground }}
        >
          Reference data
        </Text>
        <Text className="text-[22px] font-bold" style={{ color: p.foreground }}>
          Masters
        </Text>
        <Text className="text-[13px]" style={{ color: p.mutedForeground }}>
          Customers, job workers, suppliers and deniers used across challans.
        </Text>
      </View>

      {/* Segmented control — the phone translation of web's tab list. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-1.5 px-4 pt-4"
      >
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Pressable
              key={t.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => selectTab(t.key)}
              className="min-h-[40px] flex-row items-center gap-1.5 rounded-full border px-3.5"
              style={({ pressed }) => ({
                backgroundColor: active ? p.primary : p.card,
                borderColor: active ? p.primary : p.border,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Feather
                name={t.icon}
                size={14}
                color={active ? p.primaryForeground : p.mutedForeground}
              />
              <Text
                className="text-[13px] font-semibold"
                style={{ color: active ? p.primaryForeground : p.foreground }}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {tab === "customers" ? (
        <MasterTab
          key="customers"
          config={customerConfig}
          canManage={canManage}
          label="Customers"
        />
      ) : null}
      {tab === "jobWorkers" ? (
        <MasterTab
          key="jobWorkers"
          config={jobWorkerConfig}
          canManage={canManage}
          label="Job workers"
        />
      ) : null}
      {tab === "deniers" ? (
        <MasterTab
          key="deniers"
          config={denierConfig}
          canManage={canManage}
          label="Deniers"
        />
      ) : null}
      {tab === "suppliers" ? (
        <MasterTab
          key="suppliers"
          config={supplierConfig}
          canManage={canManage}
          label="Suppliers"
        />
      ) : null}
    </View>
  );
}
