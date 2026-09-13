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
import Animated, {
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
} from "react-native-reanimated";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
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
import { DateField } from "@/ui/date-sheet";
import { EASE_OUT, MORPH, MORPH_EXIT, useReduceMotion } from "@/lib/motion";
import {
  Button,
  Card,
  Badge,
  EmptyState,
  Field,
  Input,
  PageTitle,
  Screen,
  Skeleton,
} from "@/ui/kit";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SyncStrip } from "@/ui/sync";
import { useMastersLoad } from "@/lib/use-masters-load";
import { countLabel, fmtDate, fmtWt, todayLocal } from "@/lib/format";

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

/** Final/raw yarn tab strip — web's Tabs: one 44px row, 13px medium labels,
 *  and the underline indicator sliding between tabs (200ms EASE_OUT, transform
 *  only). Under reduced motion the indicator jumps instead of sliding. */
function UnderlineTabs({
  value,
  onChange,
}: {
  value: PackingType;
  onChange: (value: PackingType) => void;
}) {
  const p = usePalette();
  const reduce = useReduceMotion();
  const [stripWidth, setStripWidth] = useState(0);
  const translateX = useSharedValue(0);
  // First placement lands without a slide (web's indicator appears at the
  // active tab on mount); later switches animate.
  const placed = useRef(false);
  const [ready, setReady] = useState(false);
  const index = value === "sale" ? 0 : 1;

  useEffect(() => {
    if (!stripWidth) return;
    const target = index * (stripWidth / 2) + 10;
    if (!placed.current) {
      placed.current = true;
      translateX.value = target;
      setReady(true);
      return;
    }
    if (reduce) {
      translateX.value = target;
      return;
    }
    translateX.value = withTiming(target, { duration: 200, easing: EASE_OUT });
  }, [index, stripWidth, reduce, translateX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      className="mx-4 flex-row border-b"
      style={{ borderColor: p.border }}
      onLayout={(e) => setStripWidth(e.nativeEvent.layout.width)}
    >
      {(
        [
          ["sale", "Final yarn"],
          ["job_work", "Raw yarn"],
        ] as const
      ).map(([tab, label]) => {
        const active = value === tab;
        return (
          <Pressable
            key={tab}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(tab)}
            className="h-11 flex-1 items-center justify-center px-2.5"
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
      {stripWidth > 0 ? (
        /* Web's inset-x-2.5 rounded-full underline, transform-positioned. */
        <Animated.View
          pointerEvents="none"
          accessible={false}
          style={[
            {
              position: "absolute",
              bottom: 0,
              left: 0,
              width: stripWidth / 2 - 20,
              height: 2,
              borderRadius: 2,
              backgroundColor: p.foreground,
              opacity: ready ? 1 : 0,
            },
            indicatorStyle,
          ]}
        />
      ) : null}
    </View>
  );
}

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
  const router = useRouter();
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
        <UnderlineTabs
          value={activeTab}
          onChange={(next) => {
            // Web's tab press writes ?type=; the drawer sub-item highlight
            // follows the URL, so keep the param in sync.
            setActiveTab(next);
            router.setParams({ type: next });
          }}
        />

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
                icon="package"
                title="Couldn't load packing entries"
                message="The server didn't answer. Check your connection and retry."
                action={
                  <Button
                    label="Retry"
                    variant="outline"
                    onPress={() => void load()}
                  />
                }
              />
            </View>
          ) : filtered.length === 0 ? (
            <View className="p-4">
              <EmptyState
                icon="package"
                title="No packing entries yet"
                message="Entries created by packers will appear here."
                action={
                  can("create_packing") ? (
                    <Button
                      label="Create entry"
                      icon="plus"
                      onPress={openNewEntry}
                    />
                  ) : undefined
                }
              />
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
                          className="font-mono text-sm font-bold tabular-nums tracking-tight"
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

// Line-row motion — the fade + 8px drop + 0.98 scale the web form runs
// through AnimatePresence (MORPH in, MORPH_EXIT out); layout shifts on
// add/remove animate with the same spring.
const lineEnter: EntryExitAnimationFunction = () => {
  "worklet";
  return {
    initialValues: {
      opacity: 0,
      transform: [{ translateY: -8 }, { scale: 0.98 }],
    },
    animations: {
      opacity: withSpring(1, MORPH),
      transform: [
        { translateY: withSpring(0, MORPH) },
        { scale: withSpring(1, MORPH) },
      ],
    },
  };
};

const lineExit: EntryExitAnimationFunction = () => {
  "worklet";
  return {
    initialValues: {
      opacity: 1,
      transform: [{ translateY: 0 }, { scale: 1 }],
    },
    animations: {
      opacity: withSpring(0, MORPH_EXIT),
      transform: [
        { translateY: withSpring(-8, MORPH_EXIT) },
        { scale: withSpring(0.98, MORPH_EXIT) },
      ],
    },
  };
};

const ROW_LAYOUT = LinearTransition.springify().damping(21).stiffness(110);

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
  // Web's AnimatePresence `initial={false}`: prefilled edit rows mount without
  // an entrance — only rows the user adds animate in.
  const reduceMotion = useReduceMotion();
  const animateIds = useRef<Set<string>>(new Set());

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
    if (!date) {
      setError("Select a date.");
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
        contentContainerStyle={{ paddingBottom: 24 }}
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
            <Feather name="arrow-left" size={22} color={p.foreground} />
          </Pressable>
          <View className="min-w-0 flex-1">
            <Text
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: p.mutedForeground }}
            >
              {editId ? "Edit" : "New"} · {saleMode ? "Final yarn" : "Raw yarn"}
            </Text>
            <PageTitle className="mt-1.5">
              {editId ? "Edit" : "New"} {saleMode ? "final yarn" : "raw yarn"}{" "}
              packing
            </PageTitle>
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
              <Button label="Retry" variant="outline" onPress={retryMasters} />
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
              <Badge label={`${fmtWt(totalWt)} kg total`} tone="secondary" />
            </View>
            <View className="mt-4">
              <Field label="Date">
                <DateField
                  value={date}
                  accessibilityLabel="Date"
                  onChange={(d) => {
                    setDate(d);
                    setDirty(true);
                  }}
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
                tone="secondary"
              />
            </View>

            <View className="mt-4 gap-3">
              {saleMode
                ? saleRows.map((row, idx) => (
                    <ItemShell
                      key={row.id}
                      idx={idx}
                      netWt={row.netWt}
                      animate={animateIds.current.has(row.id)}
                      reduced={reduceMotion}
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
                                style={{ fontWeight: "600" }}
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
                      animate={animateIds.current.has(row.id)}
                      reduced={reduceMotion}
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
                                style={{ fontWeight: "600" }}
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
                icon="plus"
                variant="outline"
                className="border-dashed"
                onPress={() => {
                  if (saleMode) {
                    const row = emptySaleRow();
                    animateIds.current.add(row.id);
                    setSaleRows((pr) => [...pr, row]);
                  } else {
                    const row = emptyJobRow();
                    animateIds.current.add(row.id);
                    setJobRows((pr) => [...pr, row]);
                  }
                  setDirty(true);
                }}
              />
            </View>
          </Card>
        </View>
      </ScrollView>

      {/* Sticky action bar — web's mobile-only bottom bar, clearing the
          gesture area (same contract as returns/challan editor). */}
      <View
        className="flex-row gap-2 border-t px-4 pt-3"
        style={{
          backgroundColor: p.card,
          borderColor: p.border,
          paddingBottom: 12 + insets.bottom,
        }}
      >
        <Button
          label="Cancel"
          variant="outline"
          onPress={back}
          className="flex-1"
        />
        <Button
          label={editId ? "Update entry" : "Create entry"}
          onPress={() => void submit()}
          disabled={busy}
          loading={busy}
          className="flex-1"
        />
      </View>
    </View>
  );
}

/** One item row card: numbered line header, net badge, remove button. */
function ItemShell({
  idx,
  netWt,
  animate,
  reduced,
  removable,
  onRemove,
  children,
}: {
  idx: number;
  netWt: string;
  /** True only for rows the user added — web's AnimatePresence initial={false}. */
  animate: boolean;
  reduced: boolean;
  removable: boolean;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const p = usePalette();
  return (
    <Animated.View
      className="rounded-lg border p-4"
      entering={animate && !reduced ? lineEnter : undefined}
      exiting={reduced ? undefined : lineExit}
      layout={reduced ? undefined : ROW_LAYOUT}
      style={{ borderColor: p.border, backgroundColor: p.card }}
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
            <Feather name="trash-2" size={16} color={p.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
      <View className="mt-3">{children}</View>
    </Animated.View>
  );
}
