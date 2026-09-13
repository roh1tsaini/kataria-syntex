/**
 * Reports — the phone port of apps/app's pages/reports.tsx. Same report
 * catalog (grid → detail via ?report=), same server endpoints with from/to
 * filters, same column visibility model. Web's horizontal table becomes a
 * per-row card: the first visible column is the row headline, the rest are
 * label/value pairs (values right-aligned, ledger-style; numeric columns
 * medium weight — web's numeric-column treatment).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, Redirect } from "expo-router";
import {
  api,
  friendlyError,
  registerDataCache,
  useAuth,
  usePermission,
  useRealtimeEvent,
} from "@kataria-syntex/app-core";
import { usePalette, withAlpha } from "@/theme";
import { Button, EmptyState, Field, PageTitle, Skeleton } from "@/ui/kit";
import { DateField } from "@/ui/date-sheet";
import { AppHeader } from "@/ui/app-header";
import { SyncStrip } from "@/ui/sync";
import { uiStorage } from "@/lib/core-adapter";
import { cn } from "@/lib/cn";
import { EASE_OUT, useReduceMotion } from "@/lib/motion";
import { fmtBoxes, fmtWt } from "@/lib/format";

const REPORTS: {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  description: string;
}[] = [
  {
    id: "job-work-balance",
    label: "Job-Work Balance",
    icon: "layers",
    description: "Sent vs returned per challan",
  },
  {
    id: "over-receipts",
    label: "Over-Receipts",
    icon: "alert-triangle",
    description: "Items received exceeding sent qty",
  },
  {
    id: "stock-summary",
    label: "Stock Summary",
    icon: "clipboard",
    description: "Stock by denier × colour × lot",
  },
  {
    id: "sales-register",
    label: "Sales Register",
    icon: "file-text",
    description: "All sales challans in a period",
  },
  {
    id: "job-work-register",
    label: "Job-Work Register",
    icon: "settings",
    description: "All outward challans in a period",
  },
  {
    id: "transaction-log",
    label: "Transaction Log",
    icon: "git-branch",
    description: "All stock movements chronologically",
  },
  {
    id: "party-summary",
    label: "Party Summary",
    icon: "users",
    description: "Customer & job worker totals",
  },
];

// Keyed by "workspaceId:reportId[?query]" so one account's rows never leak
// into another's. Registered so account resets (logout/401) wipe it.
type ReportResponse = {
  items: Record<string, unknown>[];
  /** Total matching rows before the server's cap (transaction-log only). */
  total?: number;
  truncated?: boolean;
};
const reportCache: Record<string, ReportResponse> = {};
registerDataCache(() => {
  for (const key of Object.keys(reportCache)) delete reportCache[key];
});

// Column visibility persists across sessions (web uses localStorage; here
// the adapter's uiStorage), keyed by workspace so one account's layout never
// leaks into another's. Invalidation story: entries whose column no longer
// exists in a report are pruned on load, mirroring web's cleanup.

function readHiddenCols(storageKey: string): Record<string, boolean> {
  try {
    const parsed: unknown = JSON.parse(uiStorage.get(storageKey) ?? "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).filter(
          ([, v]) => typeof v === "boolean",
        ),
      ) as Record<string, boolean>;
    }
  } catch {
    // Storage may be corrupted — start clean.
  }
  return {};
}

function columnLabel(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (s) => s.toUpperCase());
}

/** Web's row-count badge is a shadcn `secondary` badge: solid bg-secondary,
 *  11px medium, tabular figures — not the tinted kit Badge. */
function CountChip({ label }: { label: string }) {
  const p = usePalette();
  return (
    <View
      className="min-h-[20px] items-center justify-center rounded-sm px-1.5 py-0.5"
      style={{ backgroundColor: p.secondary }}
    >
      <Text
        className="text-[11px] font-medium tabular-nums"
        style={{ color: p.secondaryForeground }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

export default function ReportsRoute() {
  const { report } = useLocalSearchParams<{ report?: string }>();
  const status = useAuth((s) => s.status);
  const canView = usePermission()("view_reports");
  const reportId = typeof report === "string" ? report : undefined;

  if (status === "loading") return null;
  if (status === "guest") return <Redirect href="/auth" />;
  // Web gates /reports behind ProtectedRoute requirePermission="view_reports".
  if (!canView) return <Redirect href="/" />;
  if (!reportId) return <ReportGrid />;
  return <ReportView reportId={reportId} />;
}

function ReportGrid() {
  const router = useRouter();
  const p = usePalette();
  const reduce = useReduceMotion();
  return (
    <View className="flex-1" style={{ backgroundColor: p.background }}>
      <AppHeader label="Reports" />
      <SyncStrip />
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-8 pt-5">
        <Text
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: p.mutedForeground }}
        >
          Insights
        </Text>
        <PageTitle className="mt-1.5">Reports</PageTitle>
        <Text
          className="mt-1.5 text-[15px] leading-6"
          style={{ color: p.mutedForeground }}
        >
          Totals by period, party and stock.
        </Text>
        {/* Web wraps the grid in `Reveal` — fade + 6px rise, 200ms EASE_OUT. */}
        <Animated.View
          className="mt-6 gap-3"
          entering={
            reduce
              ? undefined
              : FadeInUp.duration(200)
                  .easing(EASE_OUT)
                  .withInitialValues({ transform: [{ translateY: 6 }] })
          }
        >
          {REPORTS.map((r) => (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              onPress={() => router.push(`/reports?report=${r.id}`)}
              className="flex-row items-start gap-3 rounded-lg border p-4"
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
                backgroundColor: p.card,
                borderColor: p.border,
              })}
            >
              <View
                className="h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: p.muted }}
              >
                <Feather name={r.icon} size={20} color={p.mutedForeground} />
              </View>
              <View className="min-w-0 flex-1">
                <Text
                  className="text-sm font-semibold tracking-tight"
                  style={{ color: p.foreground }}
                >
                  {r.label}
                </Text>
                <Text
                  className="mt-1 text-xs leading-relaxed"
                  style={{ color: p.mutedForeground }}
                >
                  {r.description}
                </Text>
              </View>
              <Feather
                name="arrow-up-right"
                size={16}
                color={withAlpha(p.mutedForeground, 0.5)}
              />
            </Pressable>
          ))}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function ReportView({ reportId }: { reportId: string }) {
  const router = useRouter();
  const p = usePalette();
  const workspaceId = useAuth((s) => s.workspace?.id ?? "");
  const baseKey = `${workspaceId}:${reportId}`;
  const [data, setData] = useState<ReportResponse | null>(
    () => reportCache[baseKey] ?? null,
  );
  const [loading, setLoading] = useState(() => !reportCache[baseKey]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const colsKey = `${workspaceId}:reports.hiddenCols`;
  const [hiddenCols, setHiddenCols] = useState<Record<string, boolean>>(() =>
    readHiddenCols(colsKey),
  );
  const [colsOpen, setColsOpen] = useState(false);

  // Monotonic request id: overlapping loads (debounced date edits, realtime
  // events) resolve out of order, and a slow stale response must never
  // clobber the newer one's rows.
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const cacheKey = `${baseKey}${qs}`;
    if (!reportCache[cacheKey]) {
      setLoading(true);
    }
    setLoadError(null);
    try {
      const res = await api<ReportResponse>(`/reports/${reportId}${qs}`);
      if (seq !== loadSeq.current) return;
      reportCache[cacheKey] = res;
      setData(res);
    } catch (err) {
      if (seq !== loadSeq.current) return;
      // Clear stale rows so a failure never reads as "no data".
      setData(null);
      setLoadError(friendlyError(err));
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [baseKey, reportId, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  // Report rows derive from every document type — any write can change them.
  useRealtimeEvent(
    ["challans", "returns", "raw-material", "packing", "stock"],
    load,
  );

  const report = REPORTS.find((r) => r.id === reportId);
  const title = report?.label ?? "Report";
  const rows = data?.items ?? [];
  const columns = useMemo(
    () => (rows.length > 0 ? Object.keys(rows[0]) : []),
    [rows],
  );
  const visibleColumns = columns.filter((key) => !hiddenCols[key]);
  // Web's numeric-column rule: a column is numeric when any row holds a
  // number, and numeric cells render medium weight.
  const numericColumns = useMemo(
    () =>
      new Set(
        columns.filter((key) =>
          rows.some((row) => typeof row[key] === "number"),
        ),
      ),
    [columns, rows],
  );
  const reduce = useReduceMotion();

  // Drop visibility settings whose column no longer exists in this report.
  useEffect(() => {
    setHiddenCols((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([key]) => columns.includes(key)),
      );
      return Object.keys(next).length === Object.keys(prev).length
        ? prev
        : next;
    });
  }, [columns]);

  useEffect(() => {
    try {
      uiStorage.set(colsKey, JSON.stringify(hiddenCols));
    } catch {
      // Storage unavailable — the toggle just won't persist.
    }
  }, [hiddenCols, colsKey]);

  const toggleHidden = (key: string) =>
    setHiddenCols((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });

  // Web formats any number the same way regardless of column classification.
  const cellText = (val: unknown) => {
    if (typeof val === "number") {
      return Number.isInteger(val) ? fmtBoxes(val) : fmtWt(val);
    }
    return val === null || val === undefined ? "—" : String(val);
  };

  return (
    <View className="flex-1" style={{ backgroundColor: p.background }}>
      <AppHeader label="Reports" />
      <SyncStrip />
      <View className="flex-row items-center gap-1 px-3 pt-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to reports"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/reports")
          }
          className="h-11 w-11 items-center justify-center rounded-md"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Feather name="arrow-left" size={22} color={p.mutedForeground} />
        </Pressable>
        <View className="min-w-0 flex-1">
          <Text
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: p.mutedForeground }}
          >
            Report
          </Text>
          <PageTitle numberOfLines={1}>{title}</PageTitle>
        </View>
      </View>

      {/* Date range filters — web's `.filter-bar`: one bordered card holding
          the From/To calendar sheets (web DatePicker pair, both clearable). */}
      <View
        className="mx-4 mt-6 flex-row gap-3 rounded-lg border p-3"
        style={{ backgroundColor: p.card, borderColor: p.border }}
      >
        <View className="flex-1">
          <Field label="From">
            <DateField
              value={from}
              placeholder="From date"
              clearable
              accessibilityLabel="From date"
              onChange={setFrom}
            />
          </Field>
        </View>
        <View className="flex-1">
          <Field label="To">
            <DateField
              value={to}
              placeholder="To date"
              clearable
              accessibilityLabel="To date"
              onChange={setTo}
            />
          </Field>
        </View>
      </View>

      <View className="flex-1 pt-4">
        <View
          className="mx-4 flex-1 overflow-hidden rounded-lg border"
          style={{ backgroundColor: p.card, borderColor: p.border }}
        >
          {/* Web's card strip, shown while loading and whenever rows exist;
              its border-b is the top edge of whatever follows. */}
          {loading || rows.length > 0 ? (
            <View
              className="flex-row items-center justify-between gap-2 border-b px-4 py-2.5"
              style={{ borderColor: p.border, backgroundColor: p.muted }}
            >
              <Text
                className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: p.mutedForeground }}
                numberOfLines={1}
              >
                {title}
              </Text>
              {loading ? (
                <Skeleton className="h-5 w-16 rounded-sm" />
              ) : (
                <View className="flex-row items-center gap-2">
                  <CountChip
                    label={`${rows.length.toLocaleString("en-IN")} ${rows.length === 1 ? "row" : "rows"}`}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Toggle columns"
                    onPress={() => setColsOpen((o) => !o)}
                    className="h-11 w-11 items-center justify-center rounded-md"
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  >
                    <Feather
                      name="sliders"
                      size={18}
                      color={p.mutedForeground}
                    />
                  </Pressable>
                </View>
              )}
            </View>
          ) : null}
          {rows.length > 0 && data?.truncated ? (
            <View
              className="border-b px-4 py-2"
              style={{
                borderColor: withAlpha(p.border, 0.6),
                backgroundColor: withAlpha(p.muted, 0.4),
              }}
            >
              <Text
                className="text-[12px]"
                style={{ color: p.mutedForeground }}
              >
                Showing the first {rows.length.toLocaleString("en-IN")} of{" "}
                {(data.total ?? rows.length).toLocaleString("en-IN")} rows.
                Narrow the date range to see the rest.
              </Text>
            </View>
          ) : null}
          {/* Web anchors the column popover to the sliders button; on the
              phone the same checklist drops in beneath the strip. */}
          {colsOpen && columns.length > 0 ? (
            <View
              className="gap-0.5 border-b p-1.5"
              style={{ borderColor: p.border }}
            >
              <Text
                className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: p.mutedForeground }}
              >
                Show columns
              </Text>
              {columns.map((key) => {
                const visible = !hiddenCols[key];
                const lastVisible = visible && visibleColumns.length === 1;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="checkbox"
                    accessibilityState={{
                      checked: visible,
                      disabled: lastVisible,
                    }}
                    disabled={lastVisible}
                    onPress={() => toggleHidden(key)}
                    className="min-h-[44px] flex-row items-center gap-2.5 rounded-md px-2 py-1.5"
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <View
                      className="h-5 w-5 items-center justify-center rounded border"
                      style={{
                        borderColor: p.input,
                        backgroundColor: visible ? p.primary : "transparent",
                      }}
                    >
                      {visible ? (
                        <Feather
                          name="check"
                          size={14}
                          color={p.primaryForeground}
                        />
                      ) : null}
                    </View>
                    <Text
                      className="flex-1 text-sm"
                      style={{ color: p.foreground }}
                    >
                      {columnLabel(key)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {loading ? (
            <View className="gap-3 p-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <View
                  key={i}
                  className="gap-3 rounded-lg border p-4"
                  style={{ borderColor: p.border }}
                >
                  <View className="flex-row items-center justify-between gap-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-20" />
                  </View>
                  <View className="flex-row items-center justify-between gap-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-14" />
                  </View>
                </View>
              ))}
            </View>
          ) : loadError ? (
            // Web's Empty fades in over 200ms; reduced motion collapses it.
            <Animated.View
              className="p-4"
              entering={reduce ? undefined : FadeIn.duration(200)}
            >
              <EmptyState
                icon="alert-triangle"
                title="Could not load the report."
                message={loadError}
                action={
                  <Button
                    label="Retry"
                    variant="outline"
                    icon="refresh-cw"
                    onPress={() => void load()}
                  />
                }
              />
            </Animated.View>
          ) : rows.length === 0 ? (
            <Animated.View
              className="p-4"
              entering={reduce ? undefined : FadeIn.duration(200)}
            >
              <EmptyState
                icon={report?.icon ?? "clipboard"}
                title="No data for this period"
                message="Adjust the date range or check back after more entries are made."
              />
            </Animated.View>
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(item, idx) =>
                String((item as { id?: unknown }).id ?? idx)
              }
              keyboardShouldPersistTaps="handled"
              extraData={visibleColumns}
              contentContainerStyle={{ padding: 12, gap: 12 }}
              renderItem={({ item }) => {
                const headlineKey = visibleColumns[0];
                return (
                  <View
                    className="rounded-lg border p-4"
                    style={{ backgroundColor: p.card, borderColor: p.border }}
                  >
                    {headlineKey ? (
                      <View className="mb-2 flex-row items-baseline justify-between gap-3">
                        <Text
                          className="text-[11px] font-semibold uppercase tracking-wider"
                          style={{ color: p.mutedForeground }}
                        >
                          {columnLabel(headlineKey)}
                        </Text>
                        <Text
                          className="flex-1 text-right text-sm font-semibold tabular-nums"
                          style={{ color: p.foreground }}
                        >
                          {cellText(item[headlineKey])}
                        </Text>
                      </View>
                    ) : null}
                    <View className="gap-1.5">
                      {visibleColumns.slice(1).map((key) => {
                        return (
                          <View
                            key={key}
                            className="flex-row items-baseline justify-between gap-3"
                          >
                            <Text
                              className="shrink-0 text-[13px]"
                              style={{ color: p.mutedForeground }}
                            >
                              {columnLabel(key)}
                            </Text>
                            <Text
                              className={cn(
                                "min-w-0 flex-1 text-right text-[13px] tabular-nums",
                                numericColumns.has(key) && "font-medium",
                              )}
                              style={{ color: p.foreground }}
                            >
                              {cellText(item[key])}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      </View>
    </View>
  );
}
