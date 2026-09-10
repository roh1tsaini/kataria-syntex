/**
 * Returns — the phone port of apps/app's ReturnsPage. Return notes against
 * outward job-work challans: the register (search + cards), the create/edit
 * form with the same fields, validations, balance fetch, over-receipt
 * warning and copy. Reached from More; web gates the route behind
 * create_return — here the page renders an EmptyState without it.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { MorphSheet } from "@/ui/morph-sheet";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import { SyncBanner, SyncSheet } from "@/ui/sync";
import { fmtDate, fmtWt, localDateKey } from "@/lib/format";

// ── Types ───────────────────────────────────────────────────────────────────

type ReturnEntry = {
  id: string;
  jobWorkerId: string;
  jobWorkerName: string;
  invoiceNo: string;
  date: string;
  remarks: string | null;
  createdAt: string;
};

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

type Option = { id: string; label: string };

const emptyRow = (): ItemRow => ({
  id: randomId(),
  challanId: "",
  denierId: "",
  colorId: "",
  lotNo: "",
  netWt: "",
  cones: "",
});

const countLabel = (n: number, singular: string, plural: string): string =>
  `${n.toLocaleString("en-IN")} ${n === 1 ? singular : plural}`;

const isValidDateKey = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime());

// Keyed by workspace id so one account's returns never leak into another's.
// Registered so account resets (logout/401) wipe it — see app-core data-caches.
const returnsCache: Record<string, ReturnEntry[] | null> = {};
registerDataCache(() => {
  for (const key of Object.keys(returnsCache)) delete returnsCache[key];
});

// ── Shared form helpers (same pattern as the packing port) ──────────────────

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

/** Shell-level sync strip — web renders the banner above every page; the
 * Android shell has none, so each screen mounts its own. */
function SyncStrip() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SyncBanner onOpen={() => setOpen(true)} />
      <SyncSheet open={open} onOpenChange={setOpen} />
    </>
  );
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

export default function ReturnsRoute() {
  const params = useLocalSearchParams<{ edit?: string | string[] }>();
  const paramEdit = Array.isArray(params.edit)
    ? params.edit[0]
    : (params.edit ?? undefined);
  const router = useRouter();
  const workspaceId = useAuth((s) => s.workspace?.id ?? "");
  const can = usePermission();
  const p = usePalette();
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

  // Other devices' writes arrive live; own writes refresh via store paths.
  useRealtimeEvent(["returns", "stock"], load);

  // Web gates /returns behind ProtectedRoute requirePermission="create_return"
  // (redirects home). Same gate, rendered inline as an empty state.
  if (!can("create_return")) {
    return (
      <Screen title="Returns" subtitle="Dyed yarn returned from job workers.">
        <EmptyState
          title="No access to returns"
          message="Your member role doesn't include creating returns."
        />
      </Screen>
    );
  }

  if (showForm || paramEdit || editingId) {
    return (
      <ReturnForm
        editId={editingId ?? paramEdit ?? undefined}
        onBack={() => {
          setShowForm(false);
          setEditingId(null);
          if (paramEdit) router.replace("/returns");
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

  const countText = loading
    ? "Refreshing…"
    : countLabel(filtered.length, "return", "returns");

  return (
    <Screen
      title="Returns"
      subtitle="Dyed yarn returned from job workers."
      action={<Button label="New return" onPress={() => setShowForm(true)} />}
    >
      <SyncStrip />
      <View className="flex-1 px-4 pb-6">
        {/* Search */}
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <Input
              placeholder="Search by job worker or invoice no…"
              accessibilityLabel="Search returns"
              value={q}
              onChangeText={setQ}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {q ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setQ("")}
              className="min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border"
              style={({ pressed }) => ({
                borderColor: p.border,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Feather name="x" size={16} color={p.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
        <Text
          className="mt-2 text-xs tabular-nums"
          style={{ color: p.mutedForeground }}
        >
          {countText}
        </Text>

        <View className="mt-3 flex-row items-center justify-between px-1 pb-2">
          <Text
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: p.mutedForeground }}
          >
            {filtered.length > 0 ? `${filtered.length} shown` : "register"}
          </Text>
          <Text className="text-[11px]" style={{ color: p.mutedForeground }}>
            Job worker
          </Text>
        </View>

        {loading ? (
          <View className="gap-3">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="gap-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </Card>
            ))}
          </View>
        ) : loadError ? (
          <View>
            <EmptyState
              title="Couldn't load returns"
              message="The server didn't answer. Check your connection and retry."
            />
            <Button
              label="Retry"
              variant="secondary"
              onPress={() => void load()}
            />
          </View>
        ) : filtered.length === 0 ? (
          <View>
            <EmptyState
              title="No returns yet"
              message="Returns from job workers will appear here."
            />
            <Button label="Create return" onPress={() => setShowForm(true)} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(i) => i.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
            renderItem={({ item }) => (
              <Card>
                <View className="flex-row items-start justify-between gap-2">
                  <View className="min-w-0 flex-1">
                    <View className="flex-row flex-wrap items-center gap-1.5">
                      <Text
                        className="text-[15px] font-semibold"
                        numberOfLines={1}
                        style={{ color: p.foreground }}
                      >
                        {item.jobWorkerName}
                      </Text>
                      <Text
                        className="text-xs font-bold tabular-nums"
                        style={{ color: p.mutedForeground }}
                      >
                        {item.invoiceNo}
                      </Text>
                    </View>
                    <Text
                      className="mt-1 text-xs font-medium tabular-nums"
                      style={{ color: p.mutedForeground }}
                      numberOfLines={1}
                    >
                      {fmtDate(item.date)}
                      {item.remarks ? ` · ${item.remarks}` : ""}
                    </Text>
                  </View>
                  {can("edit_return") ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Edit return ${item.invoiceNo}`}
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
              </Card>
            )}
          />
        )}
      </View>
    </Screen>
  );
}

// ── Form ────────────────────────────────────────────────────────────────────

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
  const p = usePalette();
  const [balances, setBalances] = useState<Balance[]>([]);
  const [jobWorkerId, setJobWorkerId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [date, setDate] = useState(localDateKey());
  const [remarks, setRemarks] = useState("");
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
          id: randomId(),
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
  const onJobWorkerChange = (id: string) => {
    setDirty(true);
    setJobWorkerId(id);
    setRows([emptyRow()]);
    if (!id) {
      setBalances([]);
      return;
    }
    // Drop the response when a newer selection landed first.
    const seq = ++balanceSeq.current;
    void api<{ items: Balance[] }>(`/returns/balance/${id}`)
      .then((res) => {
        if (seq !== balanceSeq.current) return;
        setBalances(res.items);
      })
      .catch(() => {
        if (seq === balanceSeq.current) setBalances([]);
      });
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
      <View
        className="flex-1 px-4 pt-4"
        style={{ backgroundColor: p.background }}
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

  const jobWorkerOptions: Option[] = jobWorkers.map((jw) => ({
    id: jw.id,
    label: jw.name,
  }));
  const challanOptions: Option[] = balances.map((b) => ({
    id: b.challanId,
    label: `${b.challanNumber} (${fmtWt(b.balance)} kg left)`,
  }));
  const denierOptions: Option[] = deniers.map((d) => ({
    id: d.id,
    label: d.name,
  }));
  const colorOptions: Option[] = colors.map((c) => ({
    id: c.id,
    label: c.name,
  }));
  const openBalances = balances.filter((b) => b.balance > 0);

  return (
    <View className="flex-1" style={{ backgroundColor: p.background }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="flex-row items-start gap-3 px-4 pt-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to returns list"
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
              {editId ? "Edit return" : "New return"}
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
                Couldn&apos;t load job workers, deniers and colours. Save is
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
              Select the job worker and enter their invoice number.
            </Text>
            <View className="mt-4 gap-3">
              <PickerField
                label="Job worker"
                placeholder="Select job worker"
                value={jobWorkerId}
                options={jobWorkerOptions}
                onSelect={(v) => onJobWorkerChange(v)}
                disabled={!!editId}
              />
              <Field label="Invoice number">
                <Input
                  value={invoiceNo}
                  onChangeText={(v) => {
                    setInvoiceNo(v);
                    setDirty(true);
                  }}
                  placeholder="e.g. INV-2026-001"
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
              <Field label="Remarks">
                <Textarea
                  value={remarks}
                  onChangeText={(v) => {
                    setRemarks(v);
                    setDirty(true);
                  }}
                  placeholder="Quality notes, damage, etc. (optional)"
                />
              </Field>
            </View>
          </Card>

          {/* Pending balances */}
          {jobWorkerId && balances.length > 0 ? (
            <Card>
              <Text
                className="text-[15px] font-semibold"
                style={{ color: p.foreground }}
              >
                Pending balances —{" "}
                {jobWorkers.find((j) => j.id === jobWorkerId)?.name}
              </Text>
              <View className="mt-3 gap-2">
                {openBalances.map((b) => (
                  <View
                    key={b.challanId}
                    className="flex-row flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2"
                    style={{ backgroundColor: `${p.muted}66` }}
                  >
                    <Text
                      className="text-[13px] font-bold tabular-nums"
                      style={{ color: p.foreground }}
                    >
                      {b.challanNumber}
                    </Text>
                    <Text
                      className="text-xs"
                      style={{ color: p.mutedForeground }}
                    >
                      {fmtDate(b.date)}
                    </Text>
                    <Badge label={`Sent: ${fmtWt(b.sent)} kg`} />
                    <Badge label={`Returned: ${fmtWt(b.returned)} kg`} />
                    <Badge
                      label={`Balance: ${fmtWt(b.balance)} kg`}
                      tone="accent"
                    />
                  </View>
                ))}
                {openBalances.length === 0 ? (
                  <Text
                    className="py-4 text-center text-sm"
                    style={{ color: p.mutedForeground }}
                  >
                    All challans fully returned.
                  </Text>
                ) : null}
              </View>
            </Card>
          ) : null}

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
                  One row per returned lot, linked to its source challan.
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
              {rows.map((row, idx) => {
                const overReceipt = rowOverReceipt(row);
                const bal = getBalance(row.challanId);
                return (
                  <View
                    key={row.id}
                    className="rounded-lg border p-4"
                    style={{
                      borderColor: overReceipt
                        ? `${p.destructive}66`
                        : p.border,
                      backgroundColor: overReceipt
                        ? `${p.destructive}0d`
                        : p.card,
                    }}
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
                      <PickerField
                        label="Challan"
                        placeholder="Select challan"
                        value={row.challanId}
                        options={challanOptions}
                        onSelect={(v) => updateRow(idx, "challanId", v)}
                      />
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
                            label="Colour"
                            placeholder="Select colour"
                            value={row.colorId}
                            options={colorOptions}
                            onSelect={(v) => updateRow(idx, "colorId", v)}
                          />
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
                          <Field label="Net wt (kg)">
                            <Input
                              keyboardType="decimal-pad"
                              value={row.netWt}
                              onChangeText={(v) => updateRow(idx, "netWt", v)}
                              placeholder="0.000"
                            />
                          </Field>
                        </View>
                      </View>
                      <Field label="Cones">
                        <Input
                          keyboardType="number-pad"
                          value={row.cones}
                          onChangeText={(v) => updateRow(idx, "cones", v)}
                          placeholder="Optional"
                        />
                      </Field>
                    </View>

                    {overReceipt && bal ? (
                      <View className="mt-2 flex-row items-center gap-1.5">
                        <Feather
                          name="alert-triangle"
                          size={12}
                          color={p.destructive}
                        />
                        <Text
                          className="flex-1 text-xs"
                          style={{ color: p.destructive }}
                        >
                          Over-receipt: exceeds balance of {fmtWt(bal.balance)}{" "}
                          kg by {fmtWt(parseFloat(row.netWt) - bal.balance)} kg
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
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
                label={editId ? "Update return" : "Create return"}
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
