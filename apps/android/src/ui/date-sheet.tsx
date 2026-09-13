/**
 * DateField — the RN counterpart of web's shadcn DatePicker
 * (apps/app date-picker.tsx + calendar.tsx at the mobile breakpoint).
 * A 44px trigger showing `DD Mon YYYY` (fmtDate, never raw ISO) opens a
 * bottom-sheet month grid: month header with prev/next, weekday row, 6x7
 * day cells, today outlined, selected day filled, outside-month days muted,
 * out-of-range days disabled per min/max, and a Today / Clear date footer.
 * Values stay ISO `YYYY-MM-DD` strings ("" when unset), built timezone-safe
 * from date parts via localDateKey. Sheet chrome is the shared MorphSheet,
 * the same surface MenuSelect uses.
 */

import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { usePalette } from "@/theme";
import { MorphSheet } from "@/ui/morph-sheet";
import { Feather } from "@/ui/feather";
import { fmtDate, localDateKey } from "@/lib/format";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Split an entry key into parts, rejecting impossible calendar dates so a
 *  corrupt value can never crash the grid (it renders as unset instead). */
function parseKey(value: string): { y: number; m: number; d: number } | null {
  if (!KEY.test(value)) return null;
  const y = Number(value.slice(0, 4));
  const m = Number(value.slice(5, 7));
  const d = Number(value.slice(8, 10));
  if (m < 1 || m > 12) return null;
  const dim = new Date(y, m, 0).getDate();
  if (d < 1 || d > dim) return null;
  return { y, m: m - 1, d };
}

const keyOf = (y: number, m: number, d: number) =>
  localDateKey(new Date(y, m, d));

export function DateField({
  value,
  onChange,
  placeholder = "Select date",
  minDate,
  maxDate,
  clearable = false,
  disabled = false,
  invalid = false,
  accessibilityLabel,
}: {
  /** ISO `YYYY-MM-DD`, "" when unset. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
  /** Web parity: the trigger X. The sheet footer always offers Clear date
   *  while a value is set, exactly like web's Calendar. */
  clearable?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  accessibilityLabel?: string;
}) {
  const p = usePalette();
  const [open, setOpen] = useState(false);
  const parsed = parseKey(value);
  const display = parsed ? fmtDate(value) : null;

  const today = useMemo(() => {
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() };
  }, []);
  const [view, setView] = useState(() =>
    parsed ? { y: parsed.y, m: parsed.m } : { y: today.y, m: today.m },
  );

  // Web's Calendar follows the selected value when it changes underneath.
  useEffect(() => {
    if (parsed) setView({ y: parsed.y, m: parsed.m });
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fixed 6x7 grid so the sheet never jumps height between months.
  const cells = useMemo(() => {
    const dim = new Date(view.y, view.m + 1, 0).getDate();
    const first = new Date(view.y, view.m, 1).getDay();
    const prevDim = new Date(view.y, view.m, 0).getDate();
    const list: { y: number; m: number; d: number; current: boolean }[] = [];
    for (let i = first - 1; i >= 0; i--)
      list.push({ y: view.y, m: view.m - 1, d: prevDim - i, current: false });
    for (let d = 1; d <= dim; d++)
      list.push({ y: view.y, m: view.m, d, current: true });
    for (let d = 1; list.length < 42; d++)
      list.push({ y: view.y, m: view.m + 1, d, current: false });
    // Date normalizes month overflow, keeping keys timezone-safe.
    return list.map((c) => ({ ...c, key: keyOf(c.y, c.m, c.d) }));
  }, [view]);

  const todayKey = keyOf(today.y, today.m, today.d);
  const outOfRange = (key: string): boolean =>
    !!(
      (minDate && KEY.test(minDate) && key < minDate) ||
      (maxDate && KEY.test(maxDate) && key > maxDate)
    );

  const pick = (key: string) => {
    onChange(key);
    setOpen(false);
  };

  return (
    <>
      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled, expanded: open }}
          accessibilityLabel={accessibilityLabel ?? placeholder}
          disabled={disabled}
          onPress={() => setOpen(true)}
          className="min-h-[44px] min-w-0 flex-1 flex-row items-center gap-1.5 rounded-md border px-3"
          style={({ pressed }) => ({
            backgroundColor: p.card,
            borderColor: invalid ? p.destructive : p.input,
            opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
          })}
        >
          <Feather name="calendar" size={16} color={p.mutedForeground} />
          <Text
            className="min-w-0 flex-1 text-[15px]"
            numberOfLines={1}
            style={{ color: display ? p.foreground : p.mutedForeground }}
          >
            {display ?? placeholder}
          </Text>
          <Feather name="chevron-down" size={16} color={p.mutedForeground} />
        </Pressable>
        {clearable && parsed && !disabled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear date"
            onPress={() => onChange("")}
            className="min-h-[44px] min-w-[44px] items-center justify-center rounded-md"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Feather name="x" size={16} color={p.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
      <MorphSheet
        open={open}
        onOpenChange={setOpen}
        title={accessibilityLabel ?? placeholder}
      >
        <View className="gap-3 px-4 pt-2">
          <View className="flex-row items-center justify-between">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              onPress={() =>
                setView((v) => ({
                  y: v.m === 0 ? v.y - 1 : v.y,
                  m: (v.m + 11) % 12,
                }))
              }
              className="h-11 w-11 items-center justify-center rounded-md"
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Feather
                name="chevron-left"
                size={16}
                color={p.mutedForeground}
              />
            </Pressable>
            <Text
              className="text-[15px] font-semibold"
              style={{ color: p.foreground }}
            >
              {MONTHS[view.m]} {view.y}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next month"
              onPress={() =>
                setView((v) => ({
                  y: v.m === 11 ? v.y + 1 : v.y,
                  m: (v.m + 1) % 12,
                }))
              }
              className="h-11 w-11 items-center justify-center rounded-md"
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Feather
                name="chevron-right"
                size={16}
                color={p.mutedForeground}
              />
            </Pressable>
          </View>
          <View className="flex-row">
            {DAYS.map((day) => (
              <View key={day} className="flex-1 items-center py-1 opacity-70">
                <Text
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: p.mutedForeground }}
                >
                  {day}
                </Text>
              </View>
            ))}
          </View>
          <View className="gap-1">
            {[0, 1, 2, 3, 4, 5].map((row) => (
              <View key={row} className="flex-row gap-1">
                {cells.slice(row * 7, row * 7 + 7).map((c) => {
                  const selected = value === c.key;
                  const isToday = c.key === todayKey;
                  const out = outOfRange(c.key);
                  return (
                    <Pressable
                      key={c.key}
                      accessibilityRole="button"
                      accessibilityLabel={fmtDate(c.key)}
                      accessibilityState={{
                        selected,
                        disabled: out,
                      }}
                      disabled={out}
                      onPress={() => pick(c.key)}
                      className="min-h-[44px] min-w-[44px] flex-1 items-center justify-center rounded-md border"
                      style={({ pressed }) => ({
                        backgroundColor: selected
                          ? p.foreground
                          : pressed
                            ? p.muted
                            : "transparent",
                        borderColor:
                          isToday && !selected ? p.foreground : "transparent",
                        borderWidth: isToday && !selected ? 1 : 0,
                        opacity: out
                          ? 0.3
                          : pressed
                            ? 0.7
                            : c.current
                              ? 1
                              : 0.4,
                      })}
                    >
                      <Text
                        className="text-[13px]"
                        style={{
                          color: selected ? p.background : p.foreground,
                          fontWeight: selected || isToday ? "600" : "400",
                        }}
                      >
                        {c.d}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
          <View
            className="flex-row items-center justify-between border-t px-1"
            style={{ borderColor: p.border }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Today"
              onPress={() => {
                setView({ y: today.y, m: today.m });
                pick(todayKey);
              }}
              className="min-h-[44px] min-w-[44px] items-center justify-center px-2"
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text className="text-xs" style={{ color: p.mutedForeground }}>
                Today
              </Text>
            </Pressable>
            {parsed ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear"
                onPress={() => pick("")}
                className="min-h-[44px] min-w-[44px] items-center justify-center px-2"
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Text className="text-xs" style={{ color: p.mutedForeground }}>
                  Clear
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </MorphSheet>
    </>
  );
}
