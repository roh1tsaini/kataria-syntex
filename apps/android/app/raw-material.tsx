/**
 * Raw material — the phone port of apps/app's RawMaterialPage. Grey yarn
 * intake: the purchase register (search + cards) and the create/edit form
 * with the same fields, colour filtered to stockType "raw" (the server
 * rejects others with color_not_raw — friendlyError maps that copy),
 * net-from-gross−tare auto-fill, packing unit/count pair and copy.
 * Reached from More; web gates the route behind create_raw_material —
 * here the page renders an EmptyState without it.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { MorphSheet } from "@/ui/morph-sheet";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import {
  registerDataCache,
  useAuth,
  usePermission,
  useMasters,
  api,
  toastSuccess,
  toastError,
  friendlyError,
  randomId,
  useRealtimeEvent,
} from "@kataria-syntex/app-core";
import { round3Str } from "@kataria-syntex/shared";
import { usePalette } from "@/theme";
import { requestDiscard } from "@/ui/confirm";
import { Textarea } from "@/ui/controls";
import {
  Button,
  Card,
  Badge,
  EmptyState,
  Field,
  Input,
  Screen,
  Skeleton,
} from "@/ui/kit";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SyncStrip } from "@/ui/sync";
import { countLabel, fmtDate, fmtWt, localDateKey } from "@/lib/format";

// ── Types ───────────────────────────────────────────────────────────────────

type RawEntry = {
  id: string;
  entryNumber: string;
  supplierId: string | null;
  supplierName: string | null;
  supplierChallanNo: string | null;
  date: string;
  notes: string | null;
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

type Option = { id: string; label: string };

const emptyRow = (): ItemRow => ({
  id: randomId(),
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

const isValidDateKey = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime());

// Keyed by workspace id so one account's entries never leak into another's.
// Registered so account resets (logout/401) wipe it — see app-core data-caches.
const rawCache: Record<string, RawEntry[] | null> = {};
registerDataCache(() => {
  for (const key of Object.keys(rawCache)) delete rawCache[key];
});

// ── Shared form helpers (same pattern as the packing/returns ports) ─────────

/** Bottom-sheet option picker — the RN counterpart of the web Select. */
function OptionSheet({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: Option[];
  value: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const p = usePalette();
  return (
    <MorphSheet
      open={visible}
      onOpenChange={(v) => !v && onClose()}
      title={title}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: 420 }}
      >
        {options.length === 0 ? (
          <Text
            className="px-4 py-6 text-center text-[13px]"
            style={{ color: p.mutedForeground }}
          >
            Nothing to choose from yet
          </Text>
        ) : (
          options.map((o) => (
            <Pressable
              key={o.id}
              accessibilityRole="button"
              onPress={() => {
                onSelect(o.id);
                onClose();
              }}
              className="min-h-[44px] flex-row items-center justify-between border-b px-4 py-3"
              style={({ pressed }) => ({
                borderColor: p.border,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                className="flex-1 text-[15px]"
                style={{ color: p.foreground }}
              >
                {o.label}
              </Text>
              {value === o.id ? (
                <Feather name="check" size={18} color={p.primary} />
              ) : null}
            </Pressable>
          ))
        )}
      </ScrollView>
    </MorphSheet>
  );
}

function PickerField({
  label,
  placeholder,
  value,
  options,
  onSelect,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: Option[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const p = usePalette();
  const selected = options.find((o) => o.id === value);
  return (
    <Field label={label}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        className="min-h-[44px] flex-row items-center justify-between rounded-lg border px-3"
        style={{ backgroundColor: p.card, borderColor: p.input }}
      >
        <Text
          className="flex-1 text-[15px]"
          numberOfLines={1}
          style={{ color: selected ? p.foreground : p.mutedForeground }}
        >
          {selected ? selected.label : placeholder}
        </Text>
        <Feather name="chevron-down" size={16} color={p.mutedForeground} />
      </Pressable>
      <OptionSheet
        visible={open}
        title={label}
        options={options}
        value={value}
        onSelect={onSelect}
        onClose={() => setOpen(false)}
      />
    </Field>
  );
}

/** Date field — YYYY-MM-DD text entry validated at submit (no date-picker
 * package in the dependency set; the web calendar guarantees this shape). */
function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <Input
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </Field>
  );
}

/** Loads master data for a form, collapsing failures into one retry state
 * (same contract as apps/app's use-masters-load hook). */
function useMastersLoad(load: () => Promise<unknown>): {
  failed: boolean;
  retry: () => void;
} {
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    setFailed(false);
    void loadRef.current().catch(() => setFailed(true));
  }, [nonce]);
  return { failed, retry: () => setNonce((n) => n + 1) };
}

/** Inline alert box for form-level errors (destructive banner). */
function ErrorBanner({ message }: { message: string }) {
  const p = usePalette();
  return (
    <View
      className="rounded-lg border px-4 py-3"
      style={{
        borderColor: `${p.destructive}33`,
        backgroundColor: `${p.destructive}14`,
      }}
    >
      <Text className="text-[13px]" style={{ color: p.destructive }}>
        {message}
      </Text>
    </View>
  );
}

// ── Route ───────────────────────────────────────────────────────────────────

export default function RawMaterialRoute() {
  const params = useLocalSearchParams<{ edit?: string | string[] }>();
  const paramEdit = Array.isArray(params.edit)
    ? params.edit[0]
    : (params.edit ?? undefined);
  const router = useRouter();
  const workspaceId = useAuth((s) => s.workspace?.id ?? "");
  const status = useAuth((s) => s.status);
  const can = usePermission();
  const p = usePalette();
  const [items, setItems] = useState<RawEntry[]>(
    () => rawCache[workspaceId] ?? [],
  );
  const [loading, setLoading] = useState(() => !rawCache[workspaceId]);
  const [loadError, setLoadError] = useState(false);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Monotonic guard: overlapping loads (a realtime event landing while one is
  // already in flight) resolve out of order, and a slow older response must
  // never overwrite a newer one.
  const loadSeq = useRef(0);
  const workspaceRef = useRef(workspaceId);
  workspaceRef.current = workspaceId;

  const load = useCallback(async () => {
    const requestedWorkspace = workspaceId;
    const seq = ++loadSeq.current;
    if (!requestedWorkspace) return;
    if (!rawCache[requestedWorkspace]) {
      setLoading(true);
    }
    setLoadError(false);
    try {
      const res = await api<{ items: RawEntry[] }>("/raw-material");
      if (
        seq !== loadSeq.current ||
        requestedWorkspace !== workspaceRef.current
      )
        return;
      rawCache[requestedWorkspace] = res.items;
      setItems(res.items);
    } catch {
      if (
        seq !== loadSeq.current ||
        requestedWorkspace !== workspaceRef.current
      )
        return;
      if (!rawCache[requestedWorkspace]) {
        setItems([]);
        setLoadError(true);
      }
    } finally {
      if (
        seq === loadSeq.current &&
        requestedWorkspace === workspaceRef.current
      )
        setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    const cached = workspaceId ? (rawCache[workspaceId] ?? null) : null;
    setItems(cached ?? []);
    setLoading(!cached);
    setLoadError(false);
    void load();
  }, [load, workspaceId]);

  // Other devices' writes arrive live; own writes refresh via store paths.
  useRealtimeEvent(["raw-material", "stock"], load);

  // Web gates /raw-material behind ProtectedRoute
  // requirePermission="create_raw_material" (redirects home).
  if (status === "loading") return null;
  if (!can("create_raw_material")) return <Redirect href="/" />;

  if (showForm || paramEdit || editingId) {
    return (
      <RawMaterialForm
        editId={editingId ?? paramEdit ?? undefined}
        onBack={() => {
          setShowForm(false);
          setEditingId(null);
          if (paramEdit) router.replace("/raw-material");
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

  const countText = loading
    ? "Refreshing…"
    : countLabel(filtered.length, "entry", "entries");

  return (
    <Screen
      eyebrow="Grey yarn intake"
      title="Raw material"
      action={
        can("create_raw_material") ? (
          <Button
            label="New entry"
            icon="plus"
            onPress={() => setShowForm(true)}
          />
        ) : undefined
      }
      banner={<SyncStrip />}
    >
      <View className="flex-1">
        {/* Filter bar — one card holding search (design.md §3) */}
        <View
          className="mx-4 rounded-lg border p-3"
          style={{ borderColor: p.border, backgroundColor: p.card }}
        >
          <View
            className="min-h-[44px] flex-row items-center rounded-md border px-1.5"
            style={{ backgroundColor: p.card, borderColor: p.input }}
          >
            <Feather
              name="search"
              size={16}
              color={p.mutedForeground}
              style={{ marginHorizontal: 8 }}
            />
            <TextInput
              placeholder="Search by supplier or entry…"
              accessibilityLabel="Search raw material entries"
              placeholderTextColor={p.mutedForeground}
              value={q}
              onChangeText={setQ}
              autoCapitalize="none"
              autoCorrect={false}
              className="min-h-[44px] flex-1 text-[15px]"
              style={{ color: p.foreground }}
            />
            {q ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setQ("")}
                className="min-h-[44px] min-w-[44px] items-center justify-center"
              >
                <Feather name="x" size={16} color={p.mutedForeground} />
              </Pressable>
            ) : null}
          </View>
        </View>
        <View className="mt-2 px-4">
          <Text
            className="text-xs tabular-nums"
            style={{ color: p.mutedForeground }}
          >
            {countText}
          </Text>
        </View>

        <View
          className="mx-4 mt-4 flex-1 overflow-hidden rounded-lg border"
          style={{ borderColor: p.border, backgroundColor: p.card }}
        >
          <View
            className="flex-row items-center justify-between border-b px-4 py-2.5"
            style={{ borderColor: p.border, backgroundColor: p.muted }}
          >
            <Text
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: p.mutedForeground }}
            >
              Entries •{" "}
              {filtered.length > 0 ? `${filtered.length} shown` : "register"}
            </Text>
            <Text className="text-[11px]" style={{ color: p.mutedForeground }}>
              Supplier
            </Text>
          </View>

          {loading ? (
            <View className="gap-3 p-3">
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  className="gap-3 rounded-lg border p-4"
                  style={{ borderColor: p.border }}
                >
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </View>
              ))}
            </View>
          ) : loadError ? (
            <View className="p-4">
              <EmptyState
                title="Couldn't load entries"
                message="The server didn't answer. Check your connection and retry."
              />
              <Button
                label="Retry"
                variant="secondary"
                onPress={() => void load()}
              />
            </View>
          ) : filtered.length === 0 ? (
            <View className="p-4">
              <EmptyState
                title="No raw material entries"
                message="Purchases from suppliers will appear here."
              />
              {can("create_raw_material") ? (
                <Button
                  label="Create entry"
                  onPress={() => setShowForm(true)}
                />
              ) : null}
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(i) => i.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 12, gap: 12 }}
              renderItem={({ item }) => (
                <View
                  className="rounded-lg border p-4"
                  style={{ borderColor: p.border, backgroundColor: p.card }}
                >
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="min-w-0 flex-1">
                      <View className="flex-row flex-wrap items-center gap-1.5">
                        <Text
                          className="text-sm font-bold tabular-nums"
                          style={{ color: p.foreground }}
                        >
                          {item.entryNumber}
                        </Text>
                        <Text
                          className="text-[15px] font-semibold"
                          numberOfLines={1}
                          style={{ color: p.foreground }}
                        >
                          {item.supplierName ?? "Unknown"}
                        </Text>
                      </View>
                      <Text
                        className="mt-1 text-xs font-medium tabular-nums"
                        style={{ color: p.mutedForeground }}
                        numberOfLines={1}
                      >
                        {fmtDate(item.date)}
                        {item.supplierChallanNo
                          ? ` · Challan ${item.supplierChallanNo}`
                          : ""}
                      </Text>
                    </View>
                    {can("edit_raw_material") ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Edit entry ${item.entryNumber}`}
                        onPress={() => setEditingId(item.id)}
                        className="min-h-[44px] min-w-[44px] items-center justify-center"
                        style={({ pressed }) => ({
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <Feather
                          name="edit-2"
                          size={16}
                          color={p.mutedForeground}
                        />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Screen>
  );
}

// ── Form ────────────────────────────────────────────────────────────────────

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
  const refreshSuppliers = useMasters((s) => s.refreshSuppliers);
  const refreshDeniers = useMasters((s) => s.refreshDeniers);
  const refreshColors = useMasters((s) => s.refreshColors);
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [supplierId, setSupplierId] = useState("");
  const [supplierChallanNo, setSupplierChallanNo] = useState("");
  const [date, setDate] = useState(localDateKey());
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<ItemRow[]>([emptyRow()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Web's useDirtyGuard warns before closing with uncommitted edits; on
  // native the discard confirm runs when leaving the form (back/cancel).
  const back = () => {
    requestDiscard(dirty, busy, onBack);
  };

  const { failed: mastersError, retry: retryMasters } = useMastersLoad(() =>
    Promise.all([refreshSuppliers(), refreshDeniers(), refreshColors()]),
  );

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
          id: randomId(),
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

  const submit = async () => {
    if (detailError) return;
    setError(null);
    if (mastersError) {
      setError("Couldn't load the master data. Retry the load first.");
      return;
    }
    if (!isValidDateKey(date)) {
      setError("Enter a date as YYYY-MM-DD");
      return;
    }
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
        toastSuccess("Raw material entry saved.");
      } else {
        await api("/raw-material", { method: "POST", body });
        toastSuccess("Raw material recorded.");
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
      <View
        className="flex-1 px-4 pt-4"
        style={{ backgroundColor: p.background, paddingTop: insets.top + 16 }}
      >
        <View className="flex-row items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <View>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="mt-2 h-3 w-36" />
          </View>
        </View>
        <Skeleton className="mt-6 h-40 rounded-lg" />
        <Skeleton className="mt-6 h-64 rounded-lg" />
      </View>
    );
  }

  // Supplier picker adds the explicit none option (web: "__none__").
  const supplierOptions: Option[] = [
    { id: "__none__", label: "— No supplier —" },
    ...suppliers.map((s) => ({ id: s.id, label: s.name })),
  ];
  const denierOptions: Option[] = deniers.map((d) => ({
    id: d.id,
    label: d.name,
  }));
  const rawColors = colors.filter((c) => c.stockType === "raw");
  const rawColorOptions: Option[] = rawColors.map((c) => ({
    id: c.id,
    label: c.name,
  }));

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: p.background, paddingTop: insets.top }}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="flex-row items-start gap-3 px-4 pt-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to raw material list"
            onPress={back}
            className="min-h-[44px] min-w-[44px] items-center justify-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Feather name="arrow-left" size={22} color={p.foreground} />
          </Pressable>
          <View className="min-w-0 flex-1">
            <Text
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: p.mutedForeground }}
            >
              {editId ? "Edit" : "New"}
            </Text>
            <Text
              className="mt-1 text-[22px] font-bold"
              style={{ color: p.foreground }}
            >
              {editId ? "Edit raw material" : "New raw material"}
            </Text>
          </View>
        </View>

        <View className="gap-4 px-4 pt-4">
          {mastersError ? (
            <View
              className="flex-row items-center justify-between gap-3 rounded-lg border px-4 py-3"
              style={{
                borderColor: `${p.destructive}33`,
                backgroundColor: `${p.destructive}14`,
              }}
            >
              <Text
                className="flex-1 text-[13px]"
                style={{ color: p.destructive }}
              >
                Couldn&apos;t load deniers, colours and suppliers. Save is
                disabled until they load.
              </Text>
              <Button
                label="Retry"
                variant="secondary"
                onPress={retryMasters}
              />
            </View>
          ) : null}

          {detailError || error ? (
            <ErrorBanner message={detailError ?? error ?? ""} />
          ) : null}

          {/* Details */}
          <Card>
            <Text
              className="text-[15px] font-semibold"
              style={{ color: p.foreground }}
            >
              Details
            </Text>
            <Text
              className="mt-0.5 text-xs"
              style={{ color: p.mutedForeground }}
            >
              Record the purchase date and optional supplier.
            </Text>
            <View className="mt-4 gap-3">
              <PickerField
                label="Supplier (optional)"
                placeholder="Select supplier"
                value={supplierId || "__none__"}
                options={supplierOptions}
                onSelect={(v) => {
                  setSupplierId(v === "__none__" ? "" : v);
                  setDirty(true);
                }}
              />
              <Field label="Supplier challan no.">
                <Input
                  value={supplierChallanNo}
                  onChangeText={(v) => {
                    setSupplierChallanNo(v);
                    setDirty(true);
                  }}
                  placeholder="e.g. SC-2026-001"
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </Field>
              <DateField
                label="Date"
                value={date}
                onChange={(d) => {
                  setDate(d);
                  setDirty(true);
                }}
              />
              <Field label="Notes">
                <Textarea
                  value={notes}
                  onChangeText={(v) => {
                    setNotes(v);
                    setDirty(true);
                  }}
                  placeholder="Optional notes about this purchase."
                />
              </Field>
            </View>
          </Card>

          {/* Items */}
          <Card>
            <View className="flex-row items-start justify-between gap-4">
              <View className="min-w-0 flex-1">
                <Text
                  className="text-[15px] font-semibold"
                  style={{ color: p.foreground }}
                >
                  Items
                </Text>
                <Text
                  className="mt-0.5 text-xs"
                  style={{ color: p.mutedForeground }}
                >
                  One row per lot of grey yarn received.
                </Text>
              </View>
              <View className="flex-row shrink-0 items-center gap-2">
                <Badge
                  label={`${rows.length} ${rows.length === 1 ? "line" : "lines"}`}
                  tone="accent"
                />
                <Badge label={`${fmtWt(totalWt)} kg total`} tone="accent" />
              </View>
            </View>

            <View className="mt-4 gap-3">
              {rows.map((row, idx) => (
                <View
                  key={row.id}
                  className="rounded-lg border p-4"
                  style={{ borderColor: p.border, backgroundColor: p.card }}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <View
                        className="size-7 items-center justify-center rounded-md"
                        style={{ backgroundColor: p.muted }}
                      >
                        <Text
                          className="text-xs"
                          style={{ color: p.mutedForeground }}
                        >
                          {idx + 1}
                        </Text>
                      </View>
                      <Text
                        className="text-xs font-bold"
                        style={{ color: p.mutedForeground }}
                      >
                        Line {idx + 1}
                      </Text>
                      {parseFloat(row.netWt) > 0 ? (
                        <View
                          className="rounded-sm px-2 py-0.5"
                          style={{ backgroundColor: `${p.success}1a` }}
                        >
                          <Text
                            className="text-[11px] font-medium"
                            style={{ color: p.success }}
                          >
                            {row.netWt} kg
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {rows.length > 1 ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove row ${idx + 1}`}
                        onPress={() => removeRow(idx)}
                        className="min-h-[44px] min-w-[44px] items-center justify-center"
                        style={({ pressed }) => ({
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <Feather
                          name="trash-2"
                          size={16}
                          color={p.destructive}
                        />
                      </Pressable>
                    ) : null}
                  </View>

                  <View className="mt-3 gap-2.5">
                    <View className="flex-row gap-2.5">
                      <View className="flex-1">
                        <PickerField
                          label="Denier"
                          placeholder="Select denier"
                          value={row.denierId}
                          options={denierOptions}
                          onSelect={(v) => updateRow(idx, "denierId", v)}
                        />
                      </View>
                      <View className="flex-1">
                        <PickerField
                          label="Colour (grey/raw)"
                          placeholder="Select colour"
                          value={row.colorId}
                          options={rawColorOptions}
                          onSelect={(v) => updateRow(idx, "colorId", v)}
                        />
                      </View>
                    </View>
                    <View className="flex-row gap-2.5">
                      <View className="flex-1">
                        <Field label="Gross wt (kg)">
                          <Input
                            keyboardType="decimal-pad"
                            value={row.grossWt}
                            onChangeText={(v) => updateRow(idx, "grossWt", v)}
                            placeholder="Optional"
                          />
                        </Field>
                      </View>
                      <View className="flex-1">
                        <Field label="Tare wt (kg)">
                          <Input
                            keyboardType="decimal-pad"
                            value={row.tareWt}
                            onChangeText={(v) => updateRow(idx, "tareWt", v)}
                            placeholder="Optional"
                          />
                        </Field>
                      </View>
                    </View>
                    <View className="flex-row gap-2.5">
                      <View className="flex-1">
                        <Field label="Net wt (kg)">
                          <Input
                            keyboardType="decimal-pad"
                            value={row.netWt}
                            onChangeText={(v) => updateRow(idx, "netWt", v)}
                            placeholder="0.000"
                          />
                        </Field>
                      </View>
                      <View className="flex-1">
                        <Field label="Cones">
                          <Input
                            keyboardType="number-pad"
                            value={row.cones}
                            onChangeText={(v) => updateRow(idx, "cones", v)}
                            placeholder="Optional"
                          />
                        </Field>
                      </View>
                    </View>
                    <View className="flex-row gap-2.5">
                      <View className="flex-1">
                        <Field label="Lot no.">
                          <Input
                            value={row.lotNo}
                            onChangeText={(v) => updateRow(idx, "lotNo", v)}
                            placeholder="Optional"
                          />
                        </Field>
                      </View>
                      <View className="flex-1">
                        <Field label="Box no.">
                          <Input
                            value={row.boxNo}
                            onChangeText={(v) => updateRow(idx, "boxNo", v)}
                            placeholder="Optional"
                          />
                        </Field>
                      </View>
                    </View>
                    <Field label="Packing">
                      <View className="flex-row items-center gap-1.5">
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{
                            selected: row.packingUnit === "bags",
                          }}
                          onPress={() =>
                            updateRow(
                              idx,
                              "packingUnit",
                              row.packingUnit === "bags" ? "" : "bags",
                            )
                          }
                          className="min-h-[44px] justify-center rounded-lg border px-3"
                          style={({ pressed }) => ({
                            borderColor:
                              row.packingUnit === "bags" ? p.primary : p.border,
                            backgroundColor:
                              row.packingUnit === "bags"
                                ? p.primary
                                : "transparent",
                            opacity: pressed ? 0.8 : 1,
                          })}
                        >
                          <Text
                            className="text-[13px] font-medium"
                            style={{
                              color:
                                row.packingUnit === "bags"
                                  ? p.primaryForeground
                                  : p.foreground,
                            }}
                          >
                            Bags
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{
                            selected: row.packingUnit === "boxes",
                          }}
                          onPress={() =>
                            updateRow(
                              idx,
                              "packingUnit",
                              row.packingUnit === "boxes" ? "" : "boxes",
                            )
                          }
                          className="min-h-[44px] justify-center rounded-lg border px-3"
                          style={({ pressed }) => ({
                            borderColor:
                              row.packingUnit === "boxes"
                                ? p.primary
                                : p.border,
                            backgroundColor:
                              row.packingUnit === "boxes"
                                ? p.primary
                                : "transparent",
                            opacity: pressed ? 0.8 : 1,
                          })}
                        >
                          <Text
                            className="text-[13px] font-medium"
                            style={{
                              color:
                                row.packingUnit === "boxes"
                                  ? p.primaryForeground
                                  : p.foreground,
                            }}
                          >
                            Boxes
                          </Text>
                        </Pressable>
                        <View className="min-w-0 flex-1">
                          <Input
                            keyboardType="number-pad"
                            value={row.packingCount}
                            onChangeText={(v) =>
                              updateRow(idx, "packingCount", v)
                            }
                            placeholder="—"
                            editable={!!row.packingUnit}
                            style={!row.packingUnit ? { opacity: 0.5 } : null}
                          />
                        </View>
                      </View>
                    </Field>
                  </View>
                </View>
              ))}
            </View>

            <View className="mt-4">
              <Button label="Add item" variant="secondary" onPress={addRow} />
            </View>
          </Card>

          {/* Actions */}
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button label="Cancel" variant="secondary" onPress={back} />
            </View>
            <View className="flex-1">
              <Button
                label={editId ? "Update entry" : "Create entry"}
                onPress={() => void submit()}
                disabled={busy}
                loading={busy}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
