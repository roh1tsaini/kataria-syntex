/**
 * Masters — the phone port of apps/app's pages/masters.tsx. Same four
 * registers (Customers / Job workers / Deniers / Suppliers) with search,
 * create/edit/delete, the same field sets and placeholders, in_use error
 * copy via friendlyError, and the manage_masters permission gate. Web's
 * underlined tab strip keeps that grammar here with one sliding indicator;
 * the tab param lives in the route (?tab=) exactly like web's search params.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, Redirect } from "expo-router";
import { MorphSheet } from "@/ui/morph-sheet";
import {
  friendlyError,
  toastError,
  toastSuccess,
  useAuth,
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
import { usePalette, withAlpha } from "@/theme";
import { EASE_OUT, useReduceMotion } from "@/lib/motion";
import {
  Button,
  Badge,
  EmptyState,
  Field,
  Input,
  Screen,
  Skeleton,
} from "@/ui/kit";
import { SyncStrip } from "@/ui/sync";
import { confirm, requestDiscard } from "@/ui/confirm";
import { AppIcon, Factory, type IconValue } from "@/ui/feather";

type TabKey = "customers" | "jobWorkers" | "deniers" | "suppliers";

const TABS: readonly { key: TabKey; label: string; icon: IconValue }[] = [
  { key: "customers", label: "Customers", icon: "users" },
  { key: "jobWorkers", label: "Job workers", icon: Factory },
  { key: "deniers", label: "Deniers", icon: "layers" },
  { key: "suppliers", label: "Suppliers", icon: "truck" },
];

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
  icon: IconValue;
};

// ── Register chrome ─────────────────────────────────────────────────────────

/** Web's Tabs on mobile: one 44px row over a hairline rule, 13px medium
 *  labels with 16px icons, and a single underline that slides between tabs
 *  (200ms EASE_OUT; instant under reduced motion). */
function UnderlineTabs({
  value,
  onChange,
}: {
  value: TabKey;
  onChange: (key: TabKey) => void;
}) {
  const p = usePalette();
  const reduce = useReduceMotion();
  const [rects, setRects] = useState<
    Partial<Record<TabKey, { x: number; width: number }>>
  >({});
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  // The first placement lands without a slide — web's indicator appears at
  // the active tab on mount; later switches animate.
  const placed = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const rect = rects[value];
    if (!rect) return;
    // inset-x-2.5 on the web trigger: the underline is inset 10px each side.
    const targetX = rect.x + 10;
    const targetWidth = Math.max(0, rect.width - 20);
    if (!placed.current) {
      placed.current = true;
      x.value = targetX;
      width.value = targetWidth;
      setReady(true);
      return;
    }
    if (reduce) {
      x.value = targetX;
      width.value = targetWidth;
      return;
    }
    x.value = withTiming(targetX, { duration: 200, easing: EASE_OUT });
    width.value = withTiming(targetWidth, { duration: 200, easing: EASE_OUT });
  }, [rects, value, reduce, x, width]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    width: width.value,
  }));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerClassName="px-4"
    >
      <View className="flex-row border-b" style={{ borderColor: p.border }}>
        {TABS.map((t) => {
          const active = t.key === value;
          return (
            <Pressable
              key={t.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(t.key)}
              onLayout={(e) => {
                const { x: tx, width: tw } = e.nativeEvent.layout;
                setRects((prev) =>
                  prev[t.key]?.x === tx && prev[t.key]?.width === tw
                    ? prev
                    : { ...prev, [t.key]: { x: tx, width: tw } },
                );
              }}
              className="h-11 flex-row items-center gap-1.5 px-2.5"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <AppIcon
                name={t.icon}
                size={16}
                color={active ? p.foreground : p.mutedForeground}
              />
              <Text
                className="text-[13px] font-medium"
                style={{ color: active ? p.foreground : p.mutedForeground }}
                numberOfLines={1}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
        {ready ? (
          <Animated.View
            pointerEvents="none"
            accessible={false}
            style={[
              {
                position: "absolute",
                bottom: 0,
                left: 0,
                height: 2,
                borderRadius: 2,
                backgroundColor: p.foreground,
              },
              indicatorStyle,
            ]}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

/** Row action — the web row's ghost sm button (44px on mobile): 16px glyph,
 *  13px medium label, muted tint on press, destructive ink for Delete. */
function RowAction({
  label,
  icon,
  onPress,
  disabled,
  destructive,
}: {
  label: string;
  icon: IconValue;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      className="min-h-[44px] flex-row items-center gap-2 rounded-md px-3"
      style={({ pressed }) => ({
        backgroundColor: pressed
          ? destructive
            ? withAlpha(p.destructive, 0.1)
            : p.muted
          : "transparent",
        opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
        transform: pressed && !disabled ? [{ scale: 0.97 }] : [{ scale: 1 }],
      })}
    >
      <AppIcon
        name={icon}
        size={16}
        color={destructive ? p.destructive : p.foreground}
      />
      <Text
        className="text-[13px] font-medium"
        style={{ color: destructive ? p.destructive : p.foreground }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ── Form dialog ─────────────────────────────────────────────────────────────

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
    <MorphSheet
      open={open}
      onOpenChange={(v) => {
        if (!v) requestDiscard(dirty, busy, onClose);
      }}
      title={editing ? `Edit ${config.singular}` : `Add ${config.singular}`}
    >
      <View>
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
          <View
            className="flex-row justify-end gap-2 border-t pt-4"
            style={{ borderColor: p.border }}
          >
            <Button
              label="Cancel"
              variant="outline"
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
    </MorphSheet>
  );
}

// ── Register tab ────────────────────────────────────────────────────────────

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

  const countLabel =
    config.loading && config.items.length === 0
      ? "Loading…"
      : q.trim()
        ? `${filtered.length} of ${config.items.length}`
        : `${config.items.length} ${config.items.length === 1 ? "record" : "records"}`;

  return (
    <View className="mt-4 flex-1">
      {/* Filter bar — one card holding search + the full-width add action */}
      <View
        className="mx-4 rounded-lg border p-3"
        style={{ backgroundColor: p.card, borderColor: p.border }}
      >
        <View>
          <Feather
            name="search"
            size={16}
            color={p.mutedForeground}
            style={{ position: "absolute", left: 12, top: 14 }}
          />
          <Input
            placeholder={`Search ${label.toLowerCase()}…`}
            accessibilityLabel={`Search ${label.toLowerCase()}`}
            value={q}
            onChangeText={setQ}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={[
              { paddingLeft: 38, paddingRight: 40 },
              {
                backgroundColor: p.card,
                borderColor: p.input,
                color: p.foreground,
              },
            ]}
          />
          {q ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setQ("")}
              className="absolute right-1 top-1 h-11 w-11 items-center justify-center rounded-full"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Feather name="x" size={14} color={p.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
        {canManage ? (
          <Button
            className="mt-3"
            label={`Add ${config.singular}`}
            icon="plus"
            onPress={openAdd}
          />
        ) : null}
      </View>

      {error ? (
        <Text
          className="mx-4 mt-4 rounded-lg border px-4 py-3 text-sm"
          role="alert"
          accessibilityLiveRegion="polite"
          style={{
            color: p.destructive,
            borderColor: `${p.destructive}33`,
            backgroundColor: `${p.destructive}14`,
          }}
        >
          {error}
        </Text>
      ) : null}

      {/* Register card — muted strip over divided rows */}
      <View
        className="mx-4 mt-4 flex-1 overflow-hidden rounded-lg border"
        style={{ backgroundColor: p.card, borderColor: p.border }}
      >
        <View
          className="flex-row items-center justify-between border-b px-4 py-2.5"
          style={{ borderColor: p.border, backgroundColor: p.muted }}
        >
          <Text
            className="text-[11px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: p.mutedForeground }}
          >
            {label}
          </Text>
          <Badge label={countLabel} tone="secondary" />
        </View>

        {config.loading && config.items.length === 0 ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <View
                key={i}
                className="flex-row items-center gap-3 px-4 py-3"
                style={
                  i < 4
                    ? {
                        borderBottomWidth: 1,
                        borderColor: withAlpha(p.border, 0.6),
                      }
                    : undefined
                }
              >
                <View className="flex-1 gap-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </View>
                <Skeleton className="h-8 w-24 rounded-md" />
              </View>
            ))}
          </View>
        ) : config.items.length === 0 ? (
          <EmptyState
            icon={config.icon}
            title={`No ${label.toLowerCase()} yet`}
            message={config.empty}
            action={
              canManage ? (
                <Button
                  label={`Add ${config.singular}`}
                  icon="plus"
                  onPress={openAdd}
                />
              ) : undefined
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="search"
            title={`Nothing matches “${q}”`}
            message="Try a different name or clear the search."
          />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item, index }) => (
              <View
                className="flex-row items-center gap-3 px-4 py-2.5"
                style={
                  index < filtered.length - 1
                    ? {
                        borderBottomWidth: 1,
                        borderColor: withAlpha(p.border, 0.65),
                      }
                    : undefined
                }
              >
                <View className="min-w-0 flex-1">
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
                  <View className="flex-row shrink-0 items-center gap-1">
                    <RowAction
                      label="Edit"
                      icon="edit-2"
                      onPress={() => {
                        setEditing(item);
                        setModalOpen(true);
                      }}
                    />
                    <RowAction
                      label="Delete"
                      icon="trash-2"
                      destructive
                      disabled={deletingId === item.id}
                      onPress={() => void onDelete(item)}
                    />
                  </View>
                ) : null}
              </View>
            )}
          />
        )}
      </View>

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

// ── Route ───────────────────────────────────────────────────────────────────

export default function MastersRoute() {
  const status = useAuth((s) => s.status);
  const canManage = usePermission()("manage_masters");
  const router = useRouter();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();

  const tab: TabKey = TABS.some((t) => t.key === tabParam)
    ? (tabParam as TabKey)
    : "customers";

  const selectTab = (key: TabKey) => {
    router.setParams(key === "customers" ? { tab: undefined } : { tab: key });
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
    icon: "users",
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
    icon: Factory,
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
    icon: "layers",
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
    icon: "truck",
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

  // Web gates /masters behind ProtectedRoute requirePermission="manage_masters".
  if (status === "loading") return null;
  if (status === "guest") return <Redirect href="/auth" />;
  if (!canManage) return <Redirect href="/" />;

  return (
    <Screen
      eyebrow="Reference data"
      title="Masters"
      description="Customers, job workers, suppliers and deniers used across challans."
      banner={<SyncStrip />}
    >
      <UnderlineTabs value={tab} onChange={selectTab} />
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
    </Screen>
  );
}
