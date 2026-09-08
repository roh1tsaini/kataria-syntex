/**
 * Reports — the phone port of apps/app's pages/reports.tsx. Same report
 * catalog (grid → detail via ?report=), same server endpoints with from/to
 * filters, same column visibility model. Web's horizontal table becomes a
 * per-row card: the first visible column is the row headline, the rest are
 * label/value pairs (numeric columns right-aligned, ledger-style).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { createMMKV } from "react-native-mmkv";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  api,
  friendlyError,
  registerDataCache,
  useAuth,
  usePermission,
} from "@kataria-syntex/app-core";
import { usePalette } from "@/theme";
import { Badge, Button, EmptyState, Skeleton } from "@/ui/kit";
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
const reportCache: Record<string, { items: Record<string, unknown>[] }> = {};
registerDataCache(() => {
  for (const key of Object.keys(reportCache)) delete reportCache[key];
});

// Column visibility persists across sessions (web used localStorage; here
// MMKV). Invalidation story: entries whose column no longer exists in a
// report are pruned on load, mirroring web's cleanup pass.
const storage = createMMKV({ id: "reports-ui" });
const STORAGE_KEY = "reports.hiddenCols";

function readHiddenCols(): Record<string, boolean> {
  try {
    const parsed: unknown = JSON.parse(storage.getString(STORAGE_KEY) ?? "{}");
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

export default function ReportsRoute() {
  const { report } = useLocalSearchParams<{ report?: string }>();
  const canView = usePermission()("view_reports");
  const reportId = typeof report === "string" ? report : undefined;

  if (!canView) {
    return (
      <EmptyState
        title="No access"
        message="Your role can't open reports. Ask the admin for the view reports permission."
      />
    );
  }
  if (!reportId) return <ReportGrid />;
  return <ReportView reportId={reportId} />;
}

function ReportGrid() {
  const router = useRouter();
  const p = usePalette();
  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="px-4 pb-8 gap-2.5"
      style={{ backgroundColor: p.background }}
    >
      <Text className="text-[22px] font-bold" style={{ color: p.foreground }}>
        Reports
      </Text>
      <Text className="mb-1 text-[13px]" style={{ color: p.mutedForeground }}>
        Totals by period, party and stock.
      </Text>
      {REPORTS.map((r) => (
        <Pressable
          key={r.id}
          accessibilityRole="button"
          onPress={() => router.push(`/reports?report=${r.id}`)}
          className="flex-row items-start gap-3 rounded-xl border p-4"
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
            <Feather name={r.icon} size={18} color={p.mutedForeground} />
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
          <Feather name="arrow-up-right" size={16} color={p.mutedForeground} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

function ReportView({ reportId }: { reportId: string }) {
  const router = useRouter();
  const p = usePalette();
  const workspaceId = useAuth((s) => s.workspace?.id ?? "");
  const baseKey = `${workspaceId}:${reportId}`;
  const [data, setData] = useState<{
    items: Record<string, unknown>[];
  } | null>(() => reportCache[baseKey] ?? null);
  const [loading, setLoading] = useState(() => !reportCache[baseKey]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [hiddenCols, setHiddenCols] =
    useState<Record<string, boolean>>(readHiddenCols);
  const [colsOpen, setColsOpen] = useState(false);

  const load = useCallback(async () => {
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
      const res = await api<{ items: Record<string, unknown>[] }>(
        `/reports/${reportId}${qs}`,
      );
      reportCache[cacheKey] = res;
      setData(res);
    } catch (err) {
      // Clear stale rows so a failure never reads as "no data".
      setData(null);
      setLoadError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, [baseKey, reportId, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const report = REPORTS.find((r) => r.id === reportId);
  const title = report?.label ?? "Report";
  const rows = data?.items ?? [];
  const columns = useMemo(
    () => (rows.length > 0 ? Object.keys(rows[0]) : []),
    [rows],
  );
  const visibleColumns = columns.filter((key) => !hiddenCols[key]);
  // Numeric columns right-align so figures scan like a ledger.
  const numericColumns = useMemo(
    () =>
      new Set(
        columns.filter((key) =>
          rows.some((row) => typeof row[key] === "number"),
        ),
      ),
    [columns, rows],
  );

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
      storage.set(STORAGE_KEY, JSON.stringify(hiddenCols));
    } catch {
      // Storage unavailable — the toggle just won't persist.
    }
  }, [hiddenCols]);

  const toggleHidden = (key: string) =>
    setHiddenCols((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });

  const cellText = (val: unknown, numeric: boolean) => {
    if (typeof val === "number") {
      return numeric && Number.isInteger(val) ? fmtBoxes(val) : fmtWt(val);
    }
    return val === null || val === undefined ? "—" : String(val);
  };

  return (
    <View className="flex-1" style={{ backgroundColor: p.background }}>
      <View className="flex-row items-center gap-1 px-4 pt-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to reports"
          onPress={() => router.push("/reports")}
          className="h-11 w-11 items-center justify-center rounded-lg"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Feather name="arrow-left" size={22} color={p.foreground} />
        </Pressable>
        <View className="min-w-0 flex-1">
          <Text
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: p.mutedForeground }}
          >
            Report
          </Text>
          <Text
            className="text-[22px] font-bold"
            style={{ color: p.foreground }}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
      </View>

      {/* Date range filters — same params the web sends. */}
      <View className="flex-row gap-2 px-4 pt-4">
        <View className="flex-1 gap-1">
          <Text
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: p.mutedForeground }}
          >
            From
          </Text>
          <TextInput
            value={from}
            onChangeText={setFrom}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={p.mutedForeground}
            autoCapitalize="none"
            className="min-h-[44px] rounded-lg border px-3 text-[15px]"
            style={{
              backgroundColor: p.card,
              borderColor: p.input,
              color: p.foreground,
            }}
          />
        </View>
        <View className="flex-1 gap-1">
          <Text
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: p.mutedForeground }}
          >
            To
          </Text>
          <TextInput
            value={to}
            onChangeText={setTo}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={p.mutedForeground}
            autoCapitalize="none"
            className="min-h-[44px] rounded-lg border px-3 text-[15px]"
            style={{
              backgroundColor: p.card,
              borderColor: p.input,
              color: p.foreground,
            }}
          />
        </View>
      </View>

      <View className="flex-1 pt-4">
        {loading ? (
          <ScrollView contentContainerClassName="px-4 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <View
                key={i}
                className="flex-row items-center gap-3 rounded-xl border p-4"
                style={{ backgroundColor: p.card, borderColor: p.border }}
              >
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
              </View>
            ))}
          </ScrollView>
        ) : loadError ? (
          <ScrollView contentContainerClassName="px-4">
            <EmptyState
              title="Could not load the report."
              message={loadError}
            />
            <Button
              label="Retry"
              variant="secondary"
              onPress={() => void load()}
            />
          </ScrollView>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No data for this period"
            message="Adjust the date range or check back after more entries are made."
          />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(_, idx) =>
              String(
                (
                  rows[idx] as {
                    id?: unknown;
                  }
                )?.id ?? idx,
              )
            }
            contentContainerClassName="px-4 pb-8 gap-2"
            ListHeaderComponent={
              <View className="mb-1 flex-row items-center justify-between gap-2">
                <Badge
                  label={`${rows.length.toLocaleString()} ${rows.length === 1 ? "row" : "rows"}`}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Toggle columns"
                  onPress={() => setColsOpen((o) => !o)}
                  className="h-11 w-11 items-center justify-center rounded-lg"
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  <Feather name="sliders" size={18} color={p.mutedForeground} />
                </Pressable>
              </View>
            }
            renderItem={({ item, index }) => {
              const isFirst = index === 0;
              const headlineKey = visibleColumns[0];
              return (
                <View
                  className="rounded-xl border p-4"
                  style={{ backgroundColor: p.card, borderColor: p.border }}
                >
                  {isFirst && colsOpen ? (
                    <View
                      className="mb-3 gap-0.5 rounded-lg border p-1.5"
                      style={{ borderColor: p.border }}
                    >
                      <Text
                        className="px-2 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-wider"
                        style={{ color: p.mutedForeground }}
                      >
                        Show columns
                      </Text>
                      {columns.map((key) => {
                        const visible = !hiddenCols[key];
                        const lastVisible =
                          visible && visibleColumns.length === 1;
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
                            style={({ pressed }) => ({
                              opacity: pressed ? 0.7 : 1,
                            })}
                          >
                            <View
                              className="h-5 w-5 items-center justify-center rounded border"
                              style={{
                                borderColor: p.input,
                                backgroundColor: visible
                                  ? p.primary
                                  : "transparent",
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
                  {headlineKey ? (
                    <View className="mb-2 flex-row items-baseline justify-between gap-3">
                      <Text
                        className="text-[11px] font-bold uppercase tracking-wider"
                        style={{ color: p.mutedForeground }}
                      >
                        {columnLabel(headlineKey)}
                      </Text>
                      <Text
                        className="flex-1 text-right text-sm font-semibold tabular-nums"
                        style={{ color: p.foreground }}
                      >
                        {cellText(
                          item[headlineKey],
                          numericColumns.has(headlineKey),
                        )}
                      </Text>
                    </View>
                  ) : null}
                  <View className="gap-1.5">
                    {visibleColumns.slice(1).map((key) => {
                      const numeric = numericColumns.has(key);
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
                            className="min-w-0 flex-1 text-right text-[13px] font-medium tabular-nums"
                            style={{ color: p.foreground }}
                          >
                            {cellText(item[key], numeric)}
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
  );
}
