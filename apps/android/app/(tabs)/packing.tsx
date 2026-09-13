/**
 * Packing — the phone port of apps/app's PackingPage. The packer's whole app:
 * final/raw yarn tabs, the entries register, and the create/edit form with
 * the same fields, validations, numbering flow (server-assigned entry
 * numbers via the same API calls) and copy.
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
import { Redirect, useLocalSearchParams } from "expo-router";
import { MorphSheet } from "@/ui/morph-sheet";
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
import { useMastersLoad } from "@/lib/use-masters-load";
import { countLabel, fmtBoxes, fmtDate, fmtWt, todayLocal } from "@/lib/format";

// ── Form helpers shared by the packing form ─────────────────────────────────

type Option = { id: string; label: string };

/**
 * Bottom-sheet option picker — the RN counterpart of the web Select. No
 * picker library in the dependency set; a sheet keeps 44px targets and the
 * app's motion grammar.
 */
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
  disabled,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: Option[];
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const p = usePalette();
  const selected = options.find((o) => o.id === value);
  return (
    <Field label={label}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled === true }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        className="min-h-[44px] flex-row items-center justify-between rounded-lg border px-3"
        style={{
          backgroundColor: p.card,
          borderColor: p.input,
          opacity: disabled ? 0.5 : 1,
        }}
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

const isValidDateKey = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime());

/** Loads master data for a form, collapsing failures into one retry state
 * (same contract as apps/app's use-masters-load hook). */
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

// ── Types & cache ───────────────────────────────────────────────────────────

type PackingEntry = {
  id: string;
  type: string;
  entryNumber: string;
  date: string;
  createdBy: string;
  items: Array<{ id: string; netWt: number }>;
};

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

type PackingType = "sale" | "job_work";

const emptySaleRow = (): SaleItemRow => ({
  id: randomId(),
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
  id: randomId(),
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
// Registered so account resets (logout/401) wipe it — see app-core data-caches.
const packingCache: Record<
  string,
  Record<PackingType, PackingEntry[] | null>
> = {};
registerDataCache(() => {
  for (const key of Object.keys(packingCache)) delete packingCache[key];
});

// ── Route ───────────────────────────────────────────────────────────────────

export default function PackingRoute() {
  // `?type=` from the nav drawer's Final/Raw yarn sub-items drives the tab.
  const searchParams = useLocalSearchParams<{ type?: string | string[] }>();
  const rawType = Array.isArray(searchParams.type)
    ? searchParams.type[0]
    : searchParams.type;
  const paramType: PackingType = rawType === "job_work" ? "job_work" : "sale";
  const [activeTab, setActiveTab] = useState<PackingType>(paramType);
  const status = useAuth((s) => s.status);
  const workspaceId = useAuth((s) => s.workspace?.id ?? "");
  const can = usePermission();
  const p = usePalette();
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
  const [formTab, setFormTab] = useState<PackingType>(activeTab);
  // Live tab mirror — the load callback's captured activeTab can't guard
  // against itself (it would always compare equal).
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const workspaceRef = useRef(workspaceId);
  workspaceRef.current = workspaceId;
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const tab = activeTab;
    const requestedWorkspace = workspaceId;
    const seq = ++loadSeq.current;
    if (!requestedWorkspace) return;
    if (!packingCache[workspaceId]?.[tab]) {
      setLoading(true);
    }
    setLoadError(false);
    try {
      const res = await api<{ items: PackingEntry[] }>(`/packing?type=${tab}`);
      if (
        seq !== loadSeq.current ||
        requestedWorkspace !== workspaceRef.current ||
        tab !== activeTabRef.current
      )
        return;
      (packingCache[workspaceId] ??= { sale: null, job_work: null })[tab] =
        res.items;
      setItems(res.items);
    } catch {
      if (
        seq === loadSeq.current &&
        requestedWorkspace === workspaceRef.current &&
        tab === activeTabRef.current &&
        !packingCache[requestedWorkspace]?.[tab]
      ) {
        setItems([]);
        setLoadError(true);
      }
    } finally {
      if (
        seq === loadSeq.current &&
        requestedWorkspace === workspaceRef.current &&
        tab === activeTabRef.current
      )
        setLoading(false);
    }
  }, [activeTab, workspaceId]);

  useEffect(() => {
    const cached = packingCache[workspaceId]?.[activeTab];
    setItems(cached ?? []);
    setLoading(!cached);
    setLoadError(false);
    void load();
  }, [load, activeTab, workspaceId]);

  // Drawer sub-nav switches the tab via `?type=`; keep state in sync.
  useEffect(() => {
    setActiveTab(paramType);
  }, [paramType]);

  // Other devices' writes arrive live; own writes refresh via store paths.
  useRealtimeEvent(["packing", "stock"], load);

  if (status === "loading") return null;
  if (status === "guest") return <Redirect href="/auth" />;
  // Web gates /packing behind ProtectedRoute requirePermission="create_packing".
  if (!can("create_packing")) return <Redirect href="/" />;
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

  // Web's countLabel takes a `loading` flag and shows "Refreshing…" — keep
  // the same copy (also mirrors the "Refreshing…" badge while stale).
  const countText = loading
    ? "Refreshing…"
    : countLabel(filtered.length, "entry", "entries");

  return (
    <Screen
      eyebrow="Dispatch"
      title="Packing"
      description="Weigh and record yarn before dispatch."
      action={
        can("create_packing") ? (
          <Button label="New entry" icon="plus" onPress={openNewEntry} />
        ) : undefined
      }
      banner={<SyncStrip />}
    >
      <View className="flex-1">
        {/* Final / raw yarn tabs — underline grammar, full width on mobile */}
        <View
          className="mx-4 flex-row border-b"
          style={{ borderColor: p.border }}
        >
          {(
            [
              ["sale", "Final yarn"],
              ["job_work", "Raw yarn"],
            ] as const
          ).map(([value, label]) => {
            const active = activeTab === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setActiveTab(value)}
                className="h-11 flex-1 items-center justify-center border-b-2 px-2.5"
                style={{ borderColor: active ? p.foreground : "transparent" }}
              >
                <Text
                  className="text-[13px] font-medium"
                  style={{ color: active ? p.foreground : p.mutedForeground }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Filter bar — one card holding search (design.md §3) */}
        <View
          className="mx-4 mt-4 rounded-lg border p-3"
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
              placeholder="Search by entry number…"
              accessibilityLabel="Search packing entries"
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

        {/* Register card */}
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
              {activeTab === "sale" ? "Final yarn" : "Raw yarn"}
            </Text>
          </View>

          {loading ? (
            <View className="gap-3 p-3">
              {[0, 1, 2].map((i) => (
                <Card key={i} className="gap-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-4 w-20" />
                </Card>
              ))}
            </View>
          ) : loadError ? (
            <View className="p-4">
              <EmptyState
                title="Couldn't load packing entries"
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
                title="No packing entries yet"
                message="Entries created by packers will appear here."
              />
              {can("create_packing") ? (
                <Button label="Create entry" onPress={openNewEntry} />
              ) : null}
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(e) => e.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 12, gap: 12 }}
              renderItem={({ item }) => {
                const totalWt = item.items.reduce((s, i) => s + i.netWt, 0);
                return (
                  <View
                    className="rounded-lg border p-4"
                    style={{ borderColor: p.border, backgroundColor: p.card }}
                  >
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="min-w-0 flex-1">
                        <Text
                          className="text-sm font-bold tabular-nums"
                          style={{ color: p.foreground }}
                        >
                          {item.entryNumber}
                        </Text>
                        <Text
                          className="mt-1 text-xs font-medium tabular-nums"
                          style={{ color: p.mutedForeground }}
                        >
                          {fmtDate(item.date)} · {item.items.length}{" "}
                          {item.items.length === 1 ? "item" : "items"}
                        </Text>
                      </View>
                      <View className="flex-row shrink-0 items-center gap-2">
                        <View className="flex-row items-baseline gap-1">
                          <Text
                            className="text-sm font-bold tabular-nums"
                            style={{ color: p.foreground }}
                          >
                            {fmtWt(totalWt)}
                          </Text>
                          <Text
                            className="text-xs font-medium"
                            style={{ color: p.mutedForeground }}
                          >
                            kg
                          </Text>
                        </View>
                        {can("edit_packing") ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Edit entry ${item.entryNumber}`}
                            onPress={() => {
                              setFormTab(
                                item.type === "job_work" ? "job_work" : "sale",
                              );
                              setEditingId(item.id);
                            }}
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
                  </View>
                );
              }}
            />
          )}
        </View>
      </View>
    </Screen>
  );
}

// ── Form ────────────────────────────────────────────────────────────────────

function PackingForm({
  type,
  editId,
  onBack,
}: {
  type: PackingType;
  editId?: string;
  onBack: () => void;
}) {
  const deniers = useMasters((s) => s.deniers);
  const colors = useMasters((s) => s.colors);
  const refreshDeniers = useMasters((s) => s.refreshDeniers);
  const refreshColors = useMasters((s) => s.refreshColors);
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState(todayLocal());
  const [saleRows, setSaleRows] = useState<SaleItemRow[]>([emptySaleRow()]);
  const [jobRows, setJobRows] = useState<JobWorkItemRow[]>([emptyJobRow()]);
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
    Promise.all([refreshDeniers(), refreshColors()]),
  );
  const p = usePalette();

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
            id: randomId(),
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
            id: randomId(),
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

  const submit = async () => {
    setError(null);
    if (detailError) return;
    if (mastersError) {
      setError("Couldn't load the master data. Retry the load first.");
      return;
    }
    if (!isValidDateKey(date)) {
      setError("Enter a date as YYYY-MM-DD");
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
        <Skeleton className="mt-6 h-32 rounded-lg" />
        <Skeleton className="mt-6 h-64 rounded-lg" />
      </View>
    );
  }

  const denierOptions: Option[] = deniers.map((d) => ({
    id: d.id,
    label: d.name,
  }));
  const colorOptions: Option[] = colors.map((c) => ({
    id: c.id,
    label: c.name,
  }));
  const saleMode = type === "sale";
  const rows = saleMode ? saleRows : jobRows;

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
            accessibilityLabel="Back to packing list"
            onPress={back}
            className="min-h-[44px] min-w-[44px] items-center justify-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Feather name="chevron-left" size={22} color={p.foreground} />
          </Pressable>
          <View className="min-w-0 flex-1">
            <Text
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: p.mutedForeground }}
            >
              {editId ? "Edit" : "New"} · {saleMode ? "Final yarn" : "Raw yarn"}
            </Text>
            <Text
              className="mt-1 text-[22px] font-bold"
              style={{ color: p.foreground }}
            >
              {editId ? "Edit" : "New"} {saleMode ? "final yarn" : "raw yarn"}{" "}
              packing
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
                Couldn&apos;t load deniers and colours. Save is disabled until
                they load.
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
            <View className="flex-row items-start justify-between gap-4">
              <View className="min-w-0 flex-1">
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
                  Date for this packing entry.
                </Text>
              </View>
              <Badge label={`${fmtWt(totalWt)} kg total`} tone="accent" />
            </View>
            <View className="mt-4">
              <DateField
                label="Date"
                value={date}
                onChange={(d) => {
                  setDate(d);
                  setDirty(true);
                }}
              />
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
                  {saleMode ? "Items — Gross / Tare" : "Items — Sack × Weight"}
                </Text>
                <Text
                  className="mt-0.5 text-xs"
                  style={{ color: p.mutedForeground }}
                >
                  {saleMode
                    ? "Weigh each box; net weight is auto-calculated."
                    : "Net weight = sack weight × number of sacks."}
                </Text>
              </View>
              <Badge
                label={`${rows.length} ${rows.length === 1 ? "line" : "lines"}`}
                tone="accent"
              />
            </View>

            <View className="mt-4 gap-3">
              {saleMode
                ? saleRows.map((row, idx) => (
                    <ItemShell
                      key={row.id}
                      idx={idx}
                      netWt={row.netWt}
                      removable={saleRows.length > 1}
                      onRemove={() => {
                        setSaleRows((pr) => pr.filter((_, i) => i !== idx));
                        setDirty(true);
                      }}
                    >
                      <View className="gap-2.5">
                        <View className="flex-row gap-2.5">
                          <View className="flex-1">
                            <PickerField
                              label="Denier"
                              placeholder="Select denier"
                              value={row.denierId}
                              options={denierOptions}
                              onSelect={(v) =>
                                updateSaleRow(idx, "denierId", v)
                              }
                            />
                          </View>
                          <View className="flex-1">
                            <PickerField
                              label="Colour"
                              placeholder="Select colour"
                              value={row.colorId}
                              options={colorOptions}
                              onSelect={(v) => updateSaleRow(idx, "colorId", v)}
                            />
                          </View>
                        </View>
                        <View className="flex-row gap-2.5">
                          <View className="flex-1">
                            <Field label="Tare (kg)">
                              <Input
                                keyboardType="decimal-pad"
                                value={row.tareWt}
                                onChangeText={(v) =>
                                  updateSaleRow(idx, "tareWt", v)
                                }
                                placeholder="0.000"
                              />
                            </Field>
                          </View>
                          <View className="flex-1">
                            <Field label="Gross (kg)">
                              <Input
                                keyboardType="decimal-pad"
                                value={row.grossWt}
                                onChangeText={(v) =>
                                  updateSaleRow(idx, "grossWt", v)
                                }
                                placeholder="0.000"
                              />
                            </Field>
                          </View>
                        </View>
                        <View className="flex-row gap-2.5">
                          <View className="flex-1">
                            <Field label="Net (kg)">
                              <Input
                                keyboardType="decimal-pad"
                                value={row.netWt}
                                onChangeText={(v) =>
                                  updateSaleRow(idx, "netWt", v)
                                }
                                placeholder="0.000"
                              />
                            </Field>
                          </View>
                          <View className="flex-1">
                            <Field label="Cones">
                              <Input
                                keyboardType="number-pad"
                                value={row.cones}
                                onChangeText={(v) =>
                                  updateSaleRow(idx, "cones", v)
                                }
                                placeholder="Optional"
                              />
                            </Field>
                          </View>
                        </View>
                        <View className="flex-row gap-2.5">
                          <View className="flex-1">
                            <Field label="Box no.">
                              <Input
                                value={row.boxNo}
                                onChangeText={(v) =>
                                  updateSaleRow(idx, "boxNo", v)
                                }
                                placeholder="Optional"
                              />
                            </Field>
                          </View>
                          <View className="flex-1">
                            <Field label="Lot no.">
                              <Input
                                value={row.lotNo}
                                onChangeText={(v) =>
                                  updateSaleRow(idx, "lotNo", v)
                                }
                                placeholder="Optional"
                              />
                            </Field>
                          </View>
                        </View>
                      </View>
                    </ItemShell>
                  ))
                : jobRows.map((row, idx) => (
                    <ItemShell
                      key={row.id}
                      idx={idx}
                      netWt={row.netWt}
                      removable={jobRows.length > 1}
                      onRemove={() => {
                        setJobRows((pr) => pr.filter((_, i) => i !== idx));
                        setDirty(true);
                      }}
                    >
                      <View className="gap-2.5">
                        <View className="flex-row gap-2.5">
                          <View className="flex-1">
                            <PickerField
                              label="Denier"
                              placeholder="Select denier"
                              value={row.denierId}
                              options={denierOptions}
                              onSelect={(v) => updateJobRow(idx, "denierId", v)}
                            />
                          </View>
                          <View className="flex-1">
                            <PickerField
                              label="Colour"
                              placeholder="Select colour"
                              value={row.colorId}
                              options={colorOptions}
                              onSelect={(v) => updateJobRow(idx, "colorId", v)}
                            />
                          </View>
                        </View>
                        <View className="flex-row gap-2.5">
                          <View className="flex-1">
                            <Field label="Sack wt (kg)">
                              <Input
                                keyboardType="decimal-pad"
                                value={row.sackWt}
                                onChangeText={(v) =>
                                  updateJobRow(idx, "sackWt", v)
                                }
                                placeholder="0.000"
                              />
                            </Field>
                          </View>
                          <View className="flex-1">
                            <Field label="Sacks">
                              <Input
                                keyboardType="number-pad"
                                value={row.sacks}
                                onChangeText={(v) =>
                                  updateJobRow(idx, "sacks", v)
                                }
                                placeholder="0"
                              />
                            </Field>
                          </View>
                        </View>
                        <View className="flex-row gap-2.5">
                          <View className="flex-1">
                            <Field label="Net (kg)">
                              <Input
                                keyboardType="decimal-pad"
                                value={row.netWt}
                                onChangeText={(v) =>
                                  updateJobRow(idx, "netWt", v)
                                }
                                placeholder="0.000"
                              />
                            </Field>
                          </View>
                          <View className="flex-1">
                            <Field label="Cones">
                              <Input
                                keyboardType="number-pad"
                                value={row.cones}
                                onChangeText={(v) =>
                                  updateJobRow(idx, "cones", v)
                                }
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
                                onChangeText={(v) =>
                                  updateJobRow(idx, "lotNo", v)
                                }
                                placeholder="Optional"
                              />
                            </Field>
                          </View>
                          <View className="flex-1">
                            <Field label="Remarks">
                              <Input
                                value={row.remarks}
                                onChangeText={(v) =>
                                  updateJobRow(idx, "remarks", v)
                                }
                                placeholder="Optional"
                              />
                            </Field>
                          </View>
                        </View>
                      </View>
                    </ItemShell>
                  ))}
            </View>

            <View className="mt-4">
              <Button
                label="Add item"
                variant="secondary"
                onPress={() => {
                  if (saleMode) setSaleRows((pr) => [...pr, emptySaleRow()]);
                  else setJobRows((pr) => [...pr, emptyJobRow()]);
                  setDirty(true);
                }}
              />
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

/** One item row card: numbered line header, net badge, remove button. */
function ItemShell({
  idx,
  netWt,
  removable,
  onRemove,
  children,
}: {
  idx: number;
  netWt: string;
  removable: boolean;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const p = usePalette();
  return (
    <View
      className="rounded-lg border p-4"
      style={{ borderColor: p.border, backgroundColor: p.background }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View
            className="size-7 items-center justify-center rounded-md"
            style={{ backgroundColor: p.muted }}
          >
            <Text className="text-xs" style={{ color: p.mutedForeground }}>
              {idx + 1}
            </Text>
          </View>
          <Text
            className="text-xs font-bold"
            style={{ color: p.mutedForeground }}
          >
            Line {idx + 1}
          </Text>
          {parseFloat(netWt) > 0 ? (
            <View
              className="rounded-sm px-2 py-0.5"
              style={{ backgroundColor: `${p.success}1a` }}
            >
              <Text
                className="text-[11px] font-medium"
                style={{ color: p.success }}
              >
                {netWt} kg
              </Text>
            </View>
          ) : null}
        </View>
        {removable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove row ${idx + 1}`}
            onPress={onRemove}
            className="min-h-[44px] min-w-[44px] items-center justify-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Feather name="trash-2" size={16} color={p.destructive} />
          </Pressable>
        ) : null}
      </View>
      <View className="mt-3">{children}</View>
    </View>
  );
}
