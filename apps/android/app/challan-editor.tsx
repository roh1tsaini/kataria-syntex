/**
 * Challan editor — the Android port of apps/app's challans-editor route.
 * One screen serves both kinds via the `kind` param (sales | outward); the
 * type is fixed at creation and never switchable (parity with the web routes
 * /challans/new and /outward/new).
 *
 * Behavior parity with apps/app/src/main/ui/pages/challans-editor.tsx:
 * edit-mode prefill from useChallans().load, the same validations and error
 * copy, totals over parsed rows via challanTotals, master-load failure
 * blocking save behind a Retry banner, the packing import sheet (sales), the
 * offline save path (the store falls back to createOfflineChallan internally
 * — this screen previews the device-issued number and toasts "will sync"),
 * and the pending_sync_edit guard. Selects/popovers become bottom sheets.
 */

import { useEffect, useRef, useState } from "react";
import {
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  useAuth,
  useChallans,
  useMasters,
  friendlyError,
  randomId,
  readCompany,
  nextSeq,
  toastSuccess,
  api,
  type ChallanInput,
  type ChallanType,
} from "@kataria-syntex/app-core";
import {
  DEFAULT_NUMBERING,
  challanTotals,
  dateStringSchema,
  fyLabelForDateString,
  formatNumberForType,
  round3,
} from "@kataria-syntex/shared";
import { usePalette } from "@/theme";
import { Badge, Button, Field, Input, Screen } from "@/ui/kit";
import { SyncBanner, SyncSheet } from "@/ui/sync";

// ── Kind descriptors (the fields these screens consume from web's
//    challans-shared.tsx) ─────────────────────────────────────────────────────

type EditorKind = {
  type: ChallanType;
  singular: string;
  party: string;
};

const KINDS: Record<"sales" | "outward", EditorKind> = {
  sales: { type: "sales", singular: "sales challan", party: "Customer" },
  outward: {
    type: "outward",
    singular: "job-work challan",
    party: "Job worker",
  },
};

// ── Format helpers (port of web ui/lib/format) ──────────────────────────────

const fmtBoxes = (n: number): string => n.toLocaleString("en-IN");
const fmtWt = (n: number): string =>
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
const todayLocal = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ── Item rows ───────────────────────────────────────────────────────────────

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
  key: randomId(),
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

// ── Bottom-sheet picker (party, denier, colour) ─────────────────────────────

type PickerOption = { id: string; label: string; subtitle?: string };

function PickerSheet({
  visible,
  title,
  options,
  loading,
  loadingText,
  emptyText,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: PickerOption[];
  loading: boolean;
  loadingText: string;
  emptyText: string;
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const p = usePalette();
  const [q, setQ] = useState("");
  useEffect(() => {
    if (!visible) setQ("");
  }, [visible]);

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? options.filter((o) => o.label.toLowerCase().includes(needle))
    : options;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1" style={{ backgroundColor: p.background }}>
        <View className="flex-row items-center justify-between px-4 pt-4">
          <Text
            className="flex-1 text-[17px] font-semibold"
            style={{ color: p.foreground }}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            className="min-h-[44px] min-w-[44px] items-center justify-center"
          >
            <Feather name="x" size={20} color={p.mutedForeground} />
          </Pressable>
        </View>

        <View className="px-4 pt-3">
          <Input
            value={q}
            onChangeText={setQ}
            placeholder="Search…"
            accessibilityLabel={`Search ${title}`}
            autoCorrect={false}
          />
        </View>

        {loading ? (
          <Text
            className="px-4 py-4 text-sm"
            style={{ color: p.mutedForeground }}
          >
            {loadingText}
          </Text>
        ) : filtered.length === 0 ? (
          <Text
            className="px-4 py-4 text-sm"
            style={{ color: p.mutedForeground }}
          >
            {options.length === 0 ? emptyText : "No matches."}
          </Text>
        ) : (
          <FlatList
            className="mt-1 flex-1 px-4"
            keyboardShouldPersistTaps="handled"
            data={filtered}
            keyExtractor={(o) => o.id}
            renderItem={({ item }) => {
              const selected = item.id === selectedId;
              return (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                  className="min-h-[44px] flex-row items-center justify-between gap-3 rounded-lg px-3 py-2.5"
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    backgroundColor: selected ? p.accentSoft : "transparent",
                  })}
                >
                  <View className="min-w-0 flex-1">
                    <Text
                      className="text-[15px]"
                      style={{
                        color: selected ? p.accentInk : p.foreground,
                        fontWeight: selected ? "600" : "400",
                      }}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                    {item.subtitle ? (
                      <Text
                        className="mt-0.5 text-[13px]"
                        style={{ color: p.mutedForeground }}
                        numberOfLines={1}
                      >
                        {item.subtitle}
                      </Text>
                    ) : null}
                  </View>
                  {selected ? (
                    <Feather name="check" size={18} color={p.accentInk} />
                  ) : null}
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

// ── Confirm modal (port of web confirm-dialog behavior) ─────────────────────

function ConfirmModal({
  visible,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const p = usePalette();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View
        className="flex-1 items-center justify-center p-6"
        style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      >
        <View
          className="w-full max-w-sm rounded-xl border p-4"
          style={{ backgroundColor: p.card, borderColor: p.border }}
        >
          <View className="flex-row items-start gap-3">
            <View
              className="h-10 w-10 items-center justify-center rounded-md"
              style={{
                backgroundColor: destructive
                  ? `${p.destructive}1a`
                  : `${p.primary}1a`,
              }}
            >
              <Feather
                name="alert-triangle"
                size={20}
                color={destructive ? p.destructive : p.primary}
              />
            </View>
            <View className="flex-1">
              <Text
                className="text-[15px] font-semibold"
                style={{ color: p.foreground }}
              >
                {title}
              </Text>
              {description ? (
                <Text
                  className="mt-1 text-[13px]"
                  style={{ color: p.mutedForeground }}
                >
                  {description}
                </Text>
              ) : null}
            </View>
          </View>
          <View className="mt-4 flex-row justify-end gap-2">
            <Button label="Cancel" variant="secondary" onPress={onCancel} />
            <Button
              label={confirmLabel}
              variant={destructive ? "destructive" : "primary"}
              onPress={onConfirm}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Masters-load (port of web use-masters-load hook) ────────────────────────

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

// ── Packing import sheet (port of web packing-import-dialog) ────────────────

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

type PackingEntry = {
  id: string;
  entryNumber: string;
  date: string;
  items: PackingItem[];
};

function PackingImportSheet({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (items: PackingItem[]) => void;
}) {
  const p = usePalette();
  const [entries, setEntries] = useState<PackingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** Bumped by Retry — re-runs the fetch without closing the sheet. */
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const res = await api<{ items: PackingEntry[] }>("/packing?type=sale");
        setEntries(res.items);
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
    <Modal
      visible={open}
      animationType="slide"
      onRequestClose={() => onOpenChange(false)}
    >
      <View className="flex-1" style={{ backgroundColor: p.background }}>
        <View className="px-4 pt-4">
          <View className="flex-row items-center justify-between">
            <Text
              className="flex-1 text-[17px] font-semibold"
              style={{ color: p.foreground }}
            >
              Import from Packing
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={() => onOpenChange(false)}
              className="min-h-[44px] min-w-[44px] items-center justify-center"
            >
              <Feather name="x" size={20} color={p.mutedForeground} />
            </Pressable>
          </View>
          <Text
            className="mt-1 text-[13px]"
            style={{ color: p.mutedForeground }}
          >
            Select packed items to add as challan rows.
          </Text>
        </View>

        <ScrollView className="flex-1" contentContainerClassName="px-4 py-4">
          {loading ? (
            <View className="gap-3">
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  className="h-16 rounded-lg"
                  style={{ backgroundColor: p.muted }}
                />
              ))}
            </View>
          ) : loadError ? (
            <View className="items-center gap-2 py-8">
              <Text className="text-sm" style={{ color: p.destructive }}>
                Couldn&apos;t load packing entries.
              </Text>
              <Button
                label="Retry"
                variant="secondary"
                onPress={() => setReloadNonce((n) => n + 1)}
              />
            </View>
          ) : entries.length === 0 ? (
            <Text
              className="py-8 text-center text-sm"
              style={{ color: p.mutedForeground }}
            >
              No packing entries available for import
            </Text>
          ) : (
            <View className="gap-4">
              {entries.map((entry) => (
                <View
                  key={entry.id}
                  className="overflow-hidden rounded-lg border"
                  style={{ borderColor: p.border }}
                >
                  <View
                    className="flex-row items-center gap-2 border-b px-3 py-2"
                    style={{
                      borderColor: `${p.border}66`,
                      backgroundColor: p.muted,
                    }}
                  >
                    <Text
                      className="font-mono text-xs font-semibold"
                      style={{ color: p.foreground }}
                    >
                      {entry.entryNumber}
                    </Text>
                    <Text
                      className="text-xs"
                      style={{ color: p.mutedForeground }}
                    >
                      {entry.date}
                    </Text>
                  </View>
                  {entry.items.map((item) => {
                    const checked = selected.has(item.id);
                    return (
                      <Pressable
                        key={item.id}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked }}
                        onPress={() => toggle(item.id)}
                        className="flex-row items-center gap-3 px-3 py-2.5"
                        style={({ pressed }) => ({
                          opacity: pressed ? 0.7 : 1,
                          backgroundColor: checked
                            ? p.accentSoft
                            : "transparent",
                        })}
                      >
                        <View
                          className="h-5 w-5 items-center justify-center rounded border"
                          style={{
                            borderColor: checked ? p.primary : p.input,
                            backgroundColor: checked
                              ? p.primary
                              : "transparent",
                          }}
                        >
                          {checked ? (
                            <Feather
                              name="check"
                              size={14}
                              color={p.primaryForeground}
                            />
                          ) : null}
                        </View>
                        <View className="min-w-0 flex-1">
                          <View className="flex-row items-center gap-2">
                            <Text
                              className="text-sm font-medium"
                              style={{ color: p.foreground }}
                            >
                              {item.denierName}
                            </Text>
                            <Text
                              className="text-sm"
                              style={{ color: p.mutedForeground }}
                            >
                              {item.colorName}
                            </Text>
                          </View>
                          <Text
                            className="text-xs"
                            style={{ color: p.mutedForeground }}
                          >
                            {item.netWt.toFixed(3)} kg
                            {item.lotNo ? ` · Lot: ${item.lotNo}` : ""}
                            {item.boxNo ? ` · Box: ${item.boxNo}` : ""}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <View
          className="flex-row justify-end gap-2 border-t px-4 py-3"
          style={{ borderColor: p.border }}
        >
          <Button
            label="Cancel"
            variant="secondary"
            onPress={() => onOpenChange(false)}
          />
          <Button
            label={selected.size > 0 ? `Import (${selected.size})` : "Import"}
            onPress={importSelected}
            disabled={selected.size === 0}
          />
        </View>
      </View>
    </Modal>
  );
}

// ── Field trigger styled like an Input (opens a PickerSheet) ────────────────

function SelectTrigger({
  label,
  loading,
  loadingText,
  emptyText,
  onPress,
}: {
  label: string | null;
  loading: boolean;
  loadingText: string;
  emptyText: string;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: loading }}
      onPress={onPress}
      disabled={loading}
      className="min-h-[44px] flex-row items-center justify-between gap-2 rounded-lg border px-3"
      style={({ pressed }) => ({
        opacity: pressed ? 0.8 : 1,
        backgroundColor: p.card,
        borderColor: p.input,
      })}
    >
      <Text
        className="flex-1 text-[15px]"
        style={{ color: label ? p.foreground : p.mutedForeground }}
        numberOfLines={1}
      >
        {loading ? loadingText : (label ?? emptyText)}
      </Text>
      <Feather name="chevron-down" size={16} color={p.mutedForeground} />
    </Pressable>
  );
}

// ── Screen ──────────────────────────────────────────────────────────────────

export default function ChallanEditorScreen() {
  const params = useLocalSearchParams<{
    kind?: string | string[];
    id?: string | string[];
  }>();
  const router = useRouter();
  const kindParam = Array.isArray(params.kind) ? params.kind[0] : params.kind;
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const kind = KINDS[kindParam === "outward" ? "outward" : "sales"];
  const isEdit = !!id;

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
  const [discardOpen, setDiscardOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [partyPickerOpen, setPartyPickerOpen] = useState(false);
  /** Row key + field ("denier" | "color") whose picker sheet is open. */
  const [rowPicker, setRowPicker] = useState<{
    rowKey: string;
    field: "denier" | "color";
  } | null>(null);
  /** Key of the most recently added row — its first input takes focus. */
  const [focusRowKey, setFocusRowKey] = useState<string | null>(null);

  const prefilled = useRef(false);

  const parties = kind.type === "sales" ? customers : jobWorkers;
  const partyLoading =
    kind.type === "sales" ? customersLoading : jobWorkersLoading;

  // Shared masters-load shape (see packing/returns/raw-material): a failed
  // load blocks save until retry. Refreshers throw offline — the editor
  // still works from cache, and the per-picker *Loading flags keep skeletons.
  const { failed: mastersFailed, retry: retryMasters } = useMastersLoad(() =>
    Promise.all([
      refreshCustomers(),
      refreshJobWorkers(),
      refreshDeniers(),
      refreshColors(),
    ]),
  );

  useEffect(() => {
    if (isEdit && id && !prefilled.current)
      void load(id).catch((err) => {
        setError(friendlyError(err, "Could not load the challan."));
      });
  }, [isEdit, id, load]);

  useEffect(() => {
    if (!isEdit) return;
    prefilled.current = false;
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

  const updateRow = (i: number, patch: Partial<ItemRow>) => {
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        const next = { ...r, ...patch };
        // Auto net weight = gross − tare; the field stays editable — later
        // gross/tare edits recompute it.
        if (patch.grossWt !== undefined || patch.tareWt !== undefined) {
          const gross = parseFloat(next.grossWt);
          const tare = parseFloat(next.tareWt);
          if (Number.isFinite(gross) && Number.isFinite(tare)) {
            const net = round3(gross - tare);
            next.netWt = net > 0 ? String(net) : "";
          }
        }
        return next;
      }),
    );
    setDirty(true);
  };

  const addRow = () => {
    const row = emptyRow();
    setRows((prev) => [...prev, row]);
    setFocusRowKey(row.key);
    setDirty(true);
  };

  const removeRow = (i: number) => {
    setRows((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i),
    );
    setDirty(true);
  };

  // Hardware back with uncommitted edits asks before discarding — the mobile
  // equivalent of the web's useDirtyGuard unload warning.
  useEffect(() => {
    if (!dirty) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setDiscardOpen(true);
      return true;
    });
    return () => sub.remove();
  }, [dirty]);

  const onCancel = () => {
    if (!dirty) {
      router.back();
      return;
    }
    setDiscardOpen(true);
  };

  const onDiscard = () => {
    setDiscardOpen(false);
    setDirty(false);
    router.back();
  };

  // Totals over parsed rows — rows without a positive net weight don't count
  // (same rule as the web editor), then challanTotals does the rounding.
  const totals = (() => {
    const parsed: Array<{
      boxes: number;
      cheese: number;
      grossWt: number;
      tareWt: number;
      netWt: number;
    }> = [];
    for (const r of rows) {
      const c = parseInt(r.cheese, 10);
      const gross = parseFloat(r.grossWt);
      const tare = parseFloat(r.tareWt);
      const n = parseFloat(r.netWt);
      if (!Number.isFinite(n) || n <= 0) continue;
      parsed.push({
        boxes: Math.max(1, parseInt(r.boxes, 10) || 1),
        cheese: Number.isFinite(c) && c > 0 ? c : 0,
        grossWt: Number.isFinite(gross) && gross > 0 ? gross : 0,
        tareWt: Number.isFinite(tare) && tare > 0 ? tare : 0,
        netWt: n,
      });
    }
    return challanTotals(parsed);
  })();

  // Offline number preview — what the store's createOfflineChallan fallback
  // would issue from the cached FY counter and company numbering.
  const offlinePreview = (() => {
    if (isEdit) return null;
    if (!dateStringSchema.safeParse(date).success) return null;
    const fyLabel = fyLabelForDateString(date);
    const numbering = readCompany()?.numbering ?? DEFAULT_NUMBERING;
    const seq = nextSeq(fyLabel, kind.type);
    return formatNumberForType(numbering, kind.type, seq, fyLabel);
  })();

  const onSave = async () => {
    if (mastersFailed) {
      setError("Couldn't load the master data. Retry the load first.");
      return;
    }
    if (!dateStringSchema.safeParse(date).success) {
      setError("Enter a real date in YYYY-MM-DD format.");
      return;
    }
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
      // The store's create() falls back to an offline challan on network
      // failure, so a pendingSync result means "saved on this device".
      if (saved.pendingSync) {
        toastSuccess(
          "Saved on this device",
          "It will sync when the server is back.",
        );
      } else {
        toastSuccess("Challan saved.");
      }
      // Web routes to the detail page after save — same flow here.
      router.replace({
        pathname: "/challan-detail",
        params: { id: saved.id, kind: kind.type },
      });
    } catch (err) {
      // Includes the pending_sync_edit guard from the store for queued
      // challans (copy served by friendlyError).
      setError(friendlyError(err));
      setSaving(false);
    }
  };

  const newLabel = kind.type === "sales" ? "sales challan" : "job-work challan";
  const p = usePalette();

  const partyOptions: PickerOption[] = parties.map((party) => ({
    id: party.id,
    label: party.name,
    subtitle: party.phone ?? undefined,
  }));
  const denierOptions: PickerOption[] = deniers.map((d) => ({
    id: d.id,
    label: d.name,
  }));
  const colorOptions: PickerOption[] = colors.map((c) => ({
    id: c.id,
    label: c.code ? `${c.code} · ${c.name}` : c.name,
  }));
  const selectedParty = parties.find((party) => party.id === partyId);
  const activeRow = rowPicker
    ? rows.find((r) => r.key === rowPicker.rowKey)
    : null;

  const handleImport = (items: PackingItem[]) => {
    const mapped: ItemRow[] = items.map((it) => ({
      key: randomId(),
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
    <Screen
      title={isEdit ? `Edit ${newLabel}` : `New ${newLabel}`}
      subtitle={`${company?.name ?? "Company"} · number assigned when saved`}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <View className="flex-1">
          <SyncBanner onOpen={() => setSyncOpen(true)} />

          <ScrollView
            className="flex-1"
            contentContainerClassName="px-4 pb-6"
            keyboardShouldPersistTaps="handled"
          >
            {error ? (
              <View
                className="mt-4 rounded-lg border px-4 py-3"
                style={{
                  borderColor: `${p.destructive}33`,
                  backgroundColor: `${p.destructive}14`,
                }}
              >
                <Text className="text-sm" style={{ color: p.destructive }}>
                  {error}
                </Text>
              </View>
            ) : null}

            {mastersFailed ? (
              <View
                className="mt-4 flex-row flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
                style={{
                  borderColor: `${p.destructive}33`,
                  backgroundColor: `${p.destructive}14`,
                }}
              >
                <Text
                  className="min-w-0 flex-1 text-sm"
                  style={{ color: p.destructive }}
                >
                  Couldn&apos;t load customers, job workers, deniers and
                  colours. Save is disabled until they load.
                </Text>
                <Button
                  label="Retry"
                  variant="secondary"
                  onPress={retryMasters}
                />
              </View>
            ) : null}

            {/* Step 1 — challan details */}
            <Text
              className="mt-6 text-[11px] font-bold uppercase tracking-wider"
              style={{ color: p.mutedForeground }}
            >
              Step 1 · Challan details
            </Text>
            <View
              className="mt-3 gap-4 rounded-xl border p-4"
              style={{ backgroundColor: p.card, borderColor: p.border }}
            >
              <Field label="Date">
                <Input
                  value={date}
                  onChangeText={(d) => {
                    setDate(d);
                    setDirty(true);
                  }}
                  placeholder="YYYY-MM-DD"
                  maxLength={10}
                  autoCorrect={false}
                  accessibilityLabel="Challan date"
                />
              </Field>
              {offlinePreview ? (
                <View className="flex-row items-center gap-2">
                  <Badge label="Offline save" tone="warning" />
                  <Text
                    className="min-w-0 flex-1 text-[13px]"
                    style={{ color: p.mutedForeground }}
                  >
                    Next number if offline:{" "}
                    <Text
                      className="font-mono font-semibold"
                      style={{ color: p.foreground }}
                    >
                      {offlinePreview}
                    </Text>{" "}
                    — it will sync automatically.
                  </Text>
                </View>
              ) : null}
              <Field label={kind.party}>
                <SelectTrigger
                  label={selectedParty?.name ?? null}
                  loading={partyLoading}
                  loadingText="Loading…"
                  emptyText={`Select ${kind.party.toLowerCase()}…`}
                  onPress={() => setPartyPickerOpen(true)}
                />
              </Field>
              <Field label="Notes">
                <Input
                  value={notes}
                  onChangeText={(n) => {
                    setNotes(n);
                    setDirty(true);
                  }}
                  placeholder="Optional remarks shown on the challan."
                  multiline
                  maxLength={500}
                  accessibilityLabel="Notes"
                />
              </Field>
            </View>

            {/* Step 2 — line items */}
            <View className="mt-6 flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1">
                <Text
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: p.mutedForeground }}
                >
                  Step 2 · Line items
                </Text>
                <Text
                  className="mt-1 text-[13px]"
                  style={{ color: p.mutedForeground }}
                >
                  One row per box with weights, yarn and lot.
                </Text>
              </View>
              <View className="shrink-0 flex-row items-center gap-2">
                {kind.type === "sales" ? (
                  <Button
                    label="Import"
                    variant="secondary"
                    onPress={() => setImportOpen(true)}
                  />
                ) : null}
                <Badge
                  label={`${rows.length} ${rows.length === 1 ? "line" : "lines"}`}
                />
              </View>
            </View>

            <View className="mt-3 gap-3">
              {rows.map((r, i) => (
                <View
                  key={r.key}
                  className="rounded-lg border p-4"
                  style={{ backgroundColor: p.card, borderColor: p.border }}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <View
                        className="h-7 w-7 items-center justify-center rounded-md"
                        style={{ backgroundColor: p.muted }}
                      >
                        <Text
                          className="text-xs font-bold"
                          style={{ color: p.mutedForeground }}
                        >
                          {i + 1}
                        </Text>
                      </View>
                      <Text
                        className="text-xs"
                        style={{ color: p.mutedForeground }}
                      >
                        Line {i + 1}
                      </Text>
                      {parseFloat(r.netWt) > 0 ? (
                        <Badge label={`${r.netWt} kg`} tone="success" />
                      ) : null}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove row ${i + 1}`}
                      onPress={() => removeRow(i)}
                      disabled={rows.length <= 1}
                      className="min-h-[44px] min-w-[44px] items-center justify-center rounded-md"
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.7 : rows.length <= 1 ? 0.4 : 1,
                      })}
                    >
                      <Feather name="x" size={18} color={p.mutedForeground} />
                    </Pressable>
                  </View>

                  <View className="mt-3 flex-row gap-2.5">
                    <View className="flex-1">
                      <Field
                        label={kind.type === "outward" ? "Sack no." : "Box no."}
                      >
                        <Input
                          value={r.boxNo}
                          placeholder={
                            kind.type === "outward" ? "S-001" : "B-001"
                          }
                          onChangeText={(v) => updateRow(i, { boxNo: v })}
                          autoFocus={focusRowKey === r.key}
                          accessibilityLabel={`Row ${i + 1} ${kind.type === "outward" ? "sack" : "box"} number`}
                        />
                      </Field>
                    </View>
                    <View className="flex-1">
                      <Field
                        label={kind.type === "outward" ? "Cones" : "Cheese"}
                      >
                        <Input
                          value={r.cheese}
                          placeholder="0"
                          keyboardType="number-pad"
                          onChangeText={(v) => updateRow(i, { cheese: v })}
                          accessibilityLabel={`Row ${i + 1} ${kind.type === "outward" ? "cones" : "cheese"}`}
                        />
                      </Field>
                    </View>
                  </View>

                  <View className="mt-2.5 flex-row gap-2.5">
                    <View className="flex-1">
                      <Field label="Gross wt.">
                        <Input
                          value={r.grossWt}
                          placeholder="0.000"
                          keyboardType="decimal-pad"
                          onChangeText={(v) => updateRow(i, { grossWt: v })}
                          accessibilityLabel={`Row ${i + 1} gross weight`}
                        />
                      </Field>
                    </View>
                    <View className="flex-1">
                      <Field label="Tare wt.">
                        <Input
                          value={r.tareWt}
                          placeholder="0.000"
                          keyboardType="decimal-pad"
                          onChangeText={(v) => updateRow(i, { tareWt: v })}
                          accessibilityLabel={`Row ${i + 1} tare weight`}
                        />
                      </Field>
                    </View>
                  </View>

                  <View className="mt-2.5 flex-row gap-2.5">
                    <View className="flex-1">
                      <Field label="Net wt. *">
                        <Input
                          value={r.netWt}
                          placeholder="0.000"
                          keyboardType="decimal-pad"
                          onChangeText={(v) => updateRow(i, { netWt: v })}
                          accessibilityLabel={`Row ${i + 1} net weight`}
                        />
                      </Field>
                    </View>
                    <View className="flex-1">
                      <Field
                        label={kind.type === "outward" ? "Sacks" : "Boxes"}
                      >
                        <Input
                          value={r.boxes}
                          placeholder="1"
                          keyboardType="number-pad"
                          onChangeText={(v) => updateRow(i, { boxes: v })}
                          accessibilityLabel={`Row ${i + 1} boxes`}
                        />
                      </Field>
                    </View>
                  </View>

                  <View className="mt-2.5 gap-2.5">
                    <Field label="Denier *">
                      <SelectTrigger
                        label={
                          deniers.find((d) => d.id === r.denierId)?.name ?? null
                        }
                        loading={deniersLoading}
                        loadingText="Loading…"
                        emptyText="Denier…"
                        onPress={() =>
                          setRowPicker({ rowKey: r.key, field: "denier" })
                        }
                      />
                    </Field>
                    <Field
                      label={
                        kind.type === "outward"
                          ? "Colour (optional)"
                          : "Colour *"
                      }
                    >
                      <SelectTrigger
                        label={
                          colorOptions.find((c) => c.id === r.colorId)?.label ??
                          null
                        }
                        loading={colorsLoading}
                        loadingText="Loading…"
                        emptyText={
                          kind.type === "outward"
                            ? "Colour (optional)…"
                            : "Colour…"
                        }
                        onPress={() =>
                          setRowPicker({ rowKey: r.key, field: "color" })
                        }
                      />
                    </Field>
                  </View>

                  <View className="mt-2.5 flex-row gap-2.5">
                    <View className="flex-1">
                      <Field label="Lot no.">
                        <Input
                          value={r.lotNo}
                          placeholder="Lot"
                          onChangeText={(v) => updateRow(i, { lotNo: v })}
                          accessibilityLabel={`Row ${i + 1} lot number`}
                        />
                      </Field>
                    </View>
                    <View className="flex-1">
                      <Field label="Remarks">
                        <Input
                          value={r.remarks}
                          placeholder="Optional"
                          onChangeText={(v) => updateRow(i, { remarks: v })}
                          accessibilityLabel={`Row ${i + 1} remarks`}
                        />
                      </Field>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            <Button
              label="Add item"
              variant="secondary"
              onPress={addRow}
              className="mt-3 w-full"
            />

            {/* Totals */}
            <View
              className="mt-6 overflow-hidden rounded-xl border"
              style={{ backgroundColor: p.card, borderColor: p.border }}
            >
              <View
                className="border-b px-5 py-4"
                style={{ borderColor: p.border }}
              >
                <Text
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: p.mutedForeground }}
                >
                  Total boxes
                </Text>
                <Text
                  className="mt-1 text-[17px] font-semibold"
                  style={{ color: p.foreground }}
                >
                  {fmtBoxes(totals.totalBoxes)}
                </Text>
              </View>
              <View className="px-5 py-4">
                <Text
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: p.mutedForeground }}
                >
                  Net weight
                </Text>
                <View className="mt-1 flex-row items-baseline gap-1">
                  <Text
                    className="text-[17px] font-semibold"
                    style={{ color: p.foreground }}
                  >
                    {fmtWt(totals.totalNetWt)}
                  </Text>
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: p.mutedForeground }}
                  >
                    kg
                  </Text>
                </View>
                <Text
                  className="mt-1 text-xs"
                  style={{ color: p.mutedForeground }}
                >
                  {totals.totalCheese > 0 ? `${totals.totalCheese} cheese` : ""}
                  {totals.totalGrossWt > 0
                    ? `${totals.totalCheese > 0 ? " • " : ""}${fmtWt(totals.totalGrossWt)} gross`
                    : ""}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Sticky action bar */}
          <View
            className="flex-row gap-2 border-t px-4 py-3"
            style={{ borderColor: p.border, backgroundColor: p.card }}
          >
            <Button
              label="Cancel"
              variant="secondary"
              onPress={onCancel}
              className="flex-1"
            />
            <Button
              label="Save"
              onPress={() => void onSave()}
              loading={saving}
              className="flex-1"
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Party picker */}
      <PickerSheet
        visible={partyPickerOpen}
        title={`Select ${kind.party.toLowerCase()}`}
        options={partyOptions}
        loading={partyLoading}
        loadingText="Loading…"
        emptyText={`No ${kind.party.toLowerCase()} yet. Add one from Masters.`}
        selectedId={partyId}
        onSelect={(v) => {
          setPartyId(v);
          setDirty(true);
        }}
        onClose={() => setPartyPickerOpen(false)}
      />

      {/* Row denier / colour picker */}
      <PickerSheet
        visible={rowPicker?.field === "denier"}
        title="Select denier"
        options={denierOptions}
        loading={deniersLoading}
        loadingText="Loading…"
        emptyText="Add from Masters."
        selectedId={activeRow?.denierId ?? ""}
        onSelect={(v) => {
          if (!rowPicker) return;
          const i = rows.findIndex((r) => r.key === rowPicker.rowKey);
          if (i >= 0) updateRow(i, { denierId: v });
        }}
        onClose={() => setRowPicker(null)}
      />
      <PickerSheet
        visible={rowPicker?.field === "color"}
        title="Select colour"
        options={colorOptions}
        loading={colorsLoading}
        loadingText="Loading…"
        emptyText="Add from Masters."
        selectedId={activeRow?.colorId ?? ""}
        onSelect={(v) => {
          if (!rowPicker) return;
          const i = rows.findIndex((r) => r.key === rowPicker.rowKey);
          if (i >= 0) updateRow(i, { colorId: v });
        }}
        onClose={() => setRowPicker(null)}
      />

      <PackingImportSheet
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleImport}
      />

      <ConfirmModal
        visible={discardOpen}
        title="Discard unsaved changes?"
        description="Edits to this challan haven't been saved yet."
        confirmLabel="Discard"
        destructive
        onConfirm={onDiscard}
        onCancel={() => setDiscardOpen(false)}
      />

      <SyncSheet open={syncOpen} onOpenChange={setSyncOpen} />
    </Screen>
  );
}
