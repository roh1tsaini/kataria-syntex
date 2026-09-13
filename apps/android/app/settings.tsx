/**
 * Settings — the Android port of apps/app's SettingsPage. Company details
 * form, per-type document numbering editor (same fields and clamps as web),
 * financial-years list, About with app version and the check-for-updates
 * row, behind the manage_settings gate (web: ProtectedRoute
 * requirePermission="manage_settings").
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import {
  useAuth,
  usePermission,
  friendlyError,
  toastError,
  toastSuccess,
  type Numbering,
  type NumberingType,
} from "@kataria-syntex/app-core";
import { formatUpdateProgress } from "@kataria-syntex/shared";
import { usePalette } from "@/theme";
import { setScheme } from "@/lib/theme";
import { cn } from "@/lib/cn";
import { fmtDate } from "@/lib/format";
import { MORPH, MORPH_EXIT, useReduceMotion } from "@/lib/motion";
import { Badge, Button, Input, Screen, Skeleton } from "@/ui/kit";
import { SyncStrip } from "@/ui/sync";
import { Feather } from "@/ui/feather";
import { appVersion } from "@/lib/core-adapter";
import { useUpdates } from "@/lib/updates";

const TYPE_LABELS: Record<keyof Numbering, string> = {
  sales: "Sales challan",
  outward: "Job work outward",
  packing_s: "Packing (Sale)",
  packing_j: "Packing (Job Work)",
  raw: "Raw Material",
};

const TYPE_HINTS: Record<keyof Numbering, string> = {
  sales: "Shown as CH/001 on sales challans",
  outward: "Shown as JW/001 on job-work challans",
  packing_s: "Shown as PKG/S/001 on sale packing",
  packing_j: "Shown as PKG/J/001 on job-work packing",
  raw: "Shown as RM/001 on raw material entries",
};

/** Card with zero padding — SettingsRows carry their own inset
 * (kit Card is always p-4; grouped rows need edge-to-edge separators). */
function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const p = usePalette();
  return (
    <View
      className={cn("overflow-hidden rounded-lg border", className)}
      style={{ backgroundColor: p.card, borderColor: p.border }}
    >
      {children}
    </View>
  );
}

type MorphGroupState = { openId: string | null; toggle: (id: string) => void };

const MorphGroupContext = createContext<MorphGroupState | null>(null);

/** One-open-per-group accordion — the RN counterpart of apps/app's MorphGroup
 *  (morph.tsx): the summary stays mounted as the toggle and the body springs
 *  open beneath it (MORPH in, MORPH_EXIT out), design.md §5.6. */
function MorphGroup({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const toggle = useCallback(
    (id: string) => setOpenId((prev) => (prev === id ? null : id)),
    [],
  );
  const value = useMemo(() => ({ openId, toggle }), [openId, toggle]);
  return (
    <MorphGroupContext.Provider value={value}>
      <View className="gap-3">{children}</View>
    </MorphGroupContext.Provider>
  );
}

/** Collapsible card whose radius steps one rung up while open (12px → 16px,
 *  design.md §5.6) and whose body height/opacity ride the morph spring.
 *  Still under reduced motion. */
function MorphPanel({
  id,
  summary,
  children,
}: {
  id: string;
  summary: ReactNode;
  children: ReactNode;
}) {
  const p = usePalette();
  const reduce = useReduceMotion();
  const group = useContext(MorphGroupContext);
  const open = group?.openId === id;
  const progress = useSharedValue(0);
  // The body stays mounted at height 0 so its natural size can be measured —
  // the open height springs between 0 and that measurement.
  const [bodyHeight, setBodyHeight] = useState(0);

  useEffect(() => {
    progress.value = reduce
      ? withTiming(open ? 1 : 0, { duration: 1 })
      : withSpring(open ? 1 : 0, open ? MORPH : MORPH_EXIT);
  }, [open, reduce, progress]);

  const panelStyle = useAnimatedStyle(() => ({
    borderRadius: 12 + progress.value * 4,
  }));
  const bodyStyle = useAnimatedStyle(() => ({
    height: bodyHeight * progress.value,
    opacity: progress.value,
  }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  return (
    <Animated.View
      className="overflow-hidden border"
      style={[{ backgroundColor: p.card, borderColor: p.border }, panelStyle]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => group?.toggle(id)}
        className="flex-row items-center justify-between gap-3 px-4 py-3"
      >
        <View className="min-w-0 flex-1">{summary}</View>
        <Animated.View style={chevronStyle}>
          <Feather name="chevron-down" size={16} color={p.mutedForeground} />
        </Animated.View>
      </Pressable>
      <Animated.View
        className="overflow-hidden"
        style={bodyStyle}
        pointerEvents={open ? "auto" : "none"}
      >
        <View onLayout={(e) => setBodyHeight(e.nativeEvent.layout.height)}>
          <View className="border-t" style={{ borderColor: p.border }}>
            {children}
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

/** iOS-style grouped section: header copy above a card of rows. */
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const p = usePalette();
  return (
    <View className="mb-6">
      <Text
        className="text-[15px] font-semibold"
        style={{ color: p.foreground }}
      >
        {title}
      </Text>
      {description ? (
        <Text className="mt-1 text-[13px]" style={{ color: p.mutedForeground }}>
          {description}
        </Text>
      ) : null}
      <View className="mt-3">{children}</View>
    </View>
  );
}

/** One grouped row — label (+optional hint) above the control, ≥44px. */
function SettingsRow({
  label,
  hint,
  last,
  children,
}: {
  label: string;
  hint?: string;
  /** Last row in its card — the trailing hairline drops (web last:border-b-0). */
  last?: boolean;
  children?: ReactNode;
}) {
  const p = usePalette();
  return (
    <View
      className={cn("gap-2 px-4 py-3", !last && "border-b")}
      style={{ borderColor: p.border }}
    >
      <View>
        <Text
          className="text-[14px] font-medium"
          style={{ color: p.foreground }}
        >
          {label}
        </Text>
        {hint ? (
          <Text className="mt-0.5 text-xs" style={{ color: p.mutedForeground }}>
            {hint}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function NumberingGroup({
  type,
  value,
  onChange,
  disabled,
}: {
  type: keyof Numbering;
  value: NumberingType;
  onChange: (v: NumberingType) => void;
  disabled: boolean;
}) {
  const p = usePalette();
  const preview = `${value.prefix}${"1".padStart(value.minDigits, "0")}${value.suffix}`;
  return (
    <MorphPanel
      id={type}
      summary={
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text
              className="text-[14px] font-semibold"
              style={{ color: p.foreground }}
            >
              {TYPE_LABELS[type]}
            </Text>
            <Text
              className="mt-0.5 text-xs"
              style={{ color: p.mutedForeground }}
              numberOfLines={1}
            >
              {TYPE_HINTS[type]}
            </Text>
          </View>
          <View
            className="shrink-0 rounded-sm px-2.5 py-1"
            style={{ backgroundColor: p.muted }}
          >
            <Text
              className="text-[13px] font-semibold"
              style={{ color: p.primary, fontFamily: "monospace" }}
            >
              {preview}
            </Text>
          </View>
        </View>
      }
    >
      <SettingsRow label="Prefix">
        <Input
          value={value.prefix}
          onChangeText={(t) => onChange({ ...value, prefix: t })}
          maxLength={10}
          placeholder="CH/"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!disabled}
          accessibilityLabel={`${TYPE_LABELS[type]} prefix`}
          style={[
            {
              fontFamily: "monospace",
              backgroundColor: p.card,
              borderColor: p.input,
              color: p.foreground,
            },
            disabled ? { opacity: 0.55 } : null,
          ]}
        />
      </SettingsRow>
      <SettingsRow label="Min digits">
        <Input
          keyboardType="number-pad"
          value={String(value.minDigits)}
          onChangeText={(t) =>
            onChange({
              ...value,
              minDigits: Math.min(6, Math.max(1, Number(t) || 1)),
            })
          }
          editable={!disabled}
          accessibilityLabel={`${TYPE_LABELS[type]} min digits`}
          style={[
            {
              backgroundColor: p.card,
              borderColor: p.input,
              color: p.foreground,
            },
            disabled ? { opacity: 0.55 } : null,
          ]}
        />
      </SettingsRow>
      <SettingsRow label="Suffix" last>
        <Input
          value={value.suffix}
          onChangeText={(t) => onChange({ ...value, suffix: t })}
          maxLength={10}
          placeholder="/26-27"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!disabled}
          accessibilityLabel={`${TYPE_LABELS[type]} suffix`}
          style={[
            {
              fontFamily: "monospace",
              backgroundColor: p.card,
              borderColor: p.input,
              color: p.foreground,
            },
            disabled ? { opacity: 0.55 } : null,
          ]}
        />
      </SettingsRow>
    </MorphPanel>
  );
}

/** "Check for updates" row — manual check + install action. The banner and
 * the blocking gate cover automatic flow; this is the deliberate one. */
function UpdateRow() {
  const checkNow = useUpdates((s) => s.checkNow);
  const installUpdate = useUpdates((s) => s.installUpdate);
  const latestVersion = useUpdates((s) => s.latestVersion);
  const checking = useUpdates((s) => s.checking);
  const status = useUpdates((s) => s.status);
  const progress = useUpdates((s) => s.progress);
  const [result, setResult] = useState<string | null>(null);
  const p = usePalette();

  const updateAvailable = latestVersion !== null && status === "ready";
  const downloading = status === "downloading";

  const check = async () => {
    setResult(null);
    const outcome = await checkNow();
    setResult(
      outcome === "up-to-date"
        ? "You're on the latest version."
        : outcome === "error"
          ? "Couldn't reach the update service."
          : null,
    );
  };

  return (
    <SettingsRow label="Updates" hint={result ?? undefined} last>
      <View className="flex-row items-center gap-2">
        {downloading && progress ? (
          <Text
            className="flex-1 text-xs tabular-nums"
            style={{ color: p.mutedForeground }}
            numberOfLines={2}
          >
            {formatUpdateProgress(progress)}
          </Text>
        ) : updateAvailable ? (
          <Text
            className="flex-1 text-xs tabular-nums"
            style={{ color: p.mutedForeground }}
          >
            v{latestVersion} available
          </Text>
        ) : null}
        {updateAvailable || downloading ? (
          <View className="shrink-0">
            <Button
              label={downloading ? "Downloading…" : "Update"}
              onPress={() => void installUpdate()}
              disabled={downloading}
              loading={downloading}
              className="min-h-[44px] px-3"
            />
          </View>
        ) : (
          <View className="shrink-0">
            <Button
              label="Check"
              variant="outline"
              icon="refresh-cw"
              onPress={() => void check()}
              disabled={checking}
              loading={checking}
              className="min-h-[44px] px-3"
            />
          </View>
        )}
      </View>
    </SettingsRow>
  );
}

function ThemeRow() {
  const p = usePalette();
  const options: {
    value: "light" | "dark";
    label: string;
    icon: "sun" | "moon";
  }[] = [
    { value: "light", label: "Light", icon: "sun" },
    { value: "dark", label: "Dark", icon: "moon" },
  ];
  return (
    <View
      className="min-h-[44px] flex-row items-center gap-1 rounded-md border p-1"
      style={{ borderColor: p.input, backgroundColor: p.card }}
      accessibilityRole="radiogroup"
    >
      {options.map((o) => {
        const active = p.scheme === o.value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${o.label} theme`}
            onPress={() => setScheme(o.value)}
            className="min-h-[44px] flex-1 flex-row items-center justify-center gap-1.5 rounded-md px-3"
            style={({ pressed }) => ({
              backgroundColor: active ? p.primary : "transparent",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Feather
              name={o.icon}
              size={15}
              color={active ? p.primaryForeground : p.mutedForeground}
            />
            <Text
              className="text-[13px] font-medium"
              style={{ color: active ? p.primaryForeground : p.foreground }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SettingsPage() {
  const isPrimaryAdmin = useAuth((s) => s.workspace?.isPrimaryAdmin);
  const can = usePermission();
  const company = useAuth((s) => s.company);
  const currentFy = useAuth((s) => s.currentFy);
  const financialYears = useAuth((s) => s.financialYears);
  const saveCompany = useAuth((s) => s.saveCompany);
  const saveNumbering = useAuth((s) => s.saveNumbering);
  const refreshCompany = useAuth((s) => s.refreshCompany);

  const [details, setDetails] = useState({
    name: "",
    gstin: "",
    pan: "",
    address: "",
    phone1: "",
    phone2: "",
  });
  const [numbering, setNumbering] = useState<Numbering | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True once the user edits anything — concurrent store refreshes
  // (other pages) must not clobber half-typed values.
  const [dirty, setDirty] = useState(false);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const p = usePalette();

  // Deep links land here without company data — fetch on mount so the form
  // never shows empty fields with perpetual skeletons.
  useEffect(() => {
    let cancelled = false;
    setCompanyLoading(true);
    setCompanyError(null);
    void refreshCompany()
      .catch((err) => {
        if (!cancelled) setCompanyError(friendlyError(err));
      })
      .finally(() => {
        if (!cancelled) setCompanyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshCompany]);

  useEffect(() => {
    if (company && !dirty) {
      setDetails({
        name: company.name,
        gstin: company.gstin,
        pan: company.pan,
        address: company.address,
        phone1: company.phone1,
        phone2: company.phone2,
      });
      setNumbering(company.numbering);
    }
  }, [company, dirty]);

  const canEdit = isPrimaryAdmin === true || can("manage_settings");

  const editDetails = (patch: Partial<typeof details>) => {
    setDetails((d) => ({ ...d, ...patch }));
    setDirty(true);
  };

  const editNumbering = (patch: Partial<Numbering>) => {
    setNumbering((n) => (n ? { ...n, ...patch } : n));
    setDirty(true);
  };

  const run = async (fn: () => Promise<void>, success: string) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
      setDirty(false);
      toastSuccess(success);
    } catch (err) {
      const msg = friendlyError(err);
      setError(msg);
      toastError("Could not save", msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      eyebrow="Company profile"
      title="Company settings"
      description={
        canEdit
          ? "Your company details and how challan numbers are generated."
          : "Read-only — only the owner can change these settings."
      }
      banner={<SyncStrip />}
    >
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="px-4 pb-8"
      >
        {companyError ? (
          <View
            className="mb-3 flex-row flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
            style={{
              borderColor: `${p.destructive}33`,
              backgroundColor: `${p.destructive}14`,
            }}
            accessibilityRole="alert"
          >
            <Text
              className="min-w-0 flex-1 text-[14px]"
              style={{ color: p.destructive }}
            >
              {companyError}
            </Text>
            <Button
              label="Retry"
              variant="outline"
              loading={companyLoading}
              onPress={() => {
                setCompanyError(null);
                setCompanyLoading(true);
                void refreshCompany()
                  .catch((err) => setCompanyError(friendlyError(err)))
                  .finally(() => setCompanyLoading(false));
              }}
            />
          </View>
        ) : null}
        {error ? (
          <View
            className="mb-3 rounded-lg border px-4 py-3"
            style={{
              borderColor: `${p.destructive}33`,
              backgroundColor: `${p.destructive}14`,
            }}
            accessibilityRole="alert"
          >
            <Text className="text-[14px]" style={{ color: p.destructive }}>
              {error}
            </Text>
          </View>
        ) : null}

        <Section
          title="Company details"
          description="Printed on challans and used as your business identity."
        >
          <Panel>
            <SettingsRow label="Company name">
              <Input
                value={details.name}
                onChangeText={(t) => editDetails({ name: t })}
                editable={canEdit}
                accessibilityLabel="Company name"
                style={[
                  {
                    backgroundColor: p.card,
                    borderColor: p.input,
                    color: p.foreground,
                  },
                  canEdit ? null : { opacity: 0.55 },
                ]}
              />
            </SettingsRow>
            <SettingsRow label="GSTIN">
              <Input
                value={details.gstin}
                onChangeText={(t) => editDetails({ gstin: t })}
                maxLength={15}
                placeholder="27ABCDE1234F1Z5"
                autoCapitalize="none"
                autoCorrect={false}
                editable={canEdit}
                accessibilityLabel="GSTIN"
                style={[
                  {
                    fontFamily: "monospace",
                    backgroundColor: p.card,
                    borderColor: p.input,
                    color: p.foreground,
                  },
                  canEdit ? null : { opacity: 0.55 },
                ]}
              />
            </SettingsRow>
            <SettingsRow label="PAN">
              <Input
                value={details.pan}
                onChangeText={(t) => editDetails({ pan: t.toUpperCase() })}
                maxLength={10}
                placeholder="ABCDE1234F"
                autoCapitalize="none"
                autoCorrect={false}
                editable={canEdit}
                accessibilityLabel="PAN"
                style={[
                  {
                    fontFamily: "monospace",
                    backgroundColor: p.card,
                    borderColor: p.input,
                    color: p.foreground,
                  },
                  canEdit ? null : { opacity: 0.55 },
                ]}
              />
            </SettingsRow>
            <SettingsRow label="Address">
              <Input
                value={details.address}
                onChangeText={(t) => editDetails({ address: t })}
                maxLength={300}
                placeholder="Full address"
                editable={canEdit}
                accessibilityLabel="Address"
                style={[
                  {
                    backgroundColor: p.card,
                    borderColor: p.input,
                    color: p.foreground,
                  },
                  canEdit ? null : { opacity: 0.55 },
                ]}
              />
            </SettingsRow>
            <SettingsRow label="Phone 1">
              <Input
                value={details.phone1}
                onChangeText={(t) => editDetails({ phone1: t })}
                maxLength={20}
                keyboardType="phone-pad"
                editable={canEdit}
                accessibilityLabel="Phone 1"
                style={[
                  {
                    backgroundColor: p.card,
                    borderColor: p.input,
                    color: p.foreground,
                  },
                  canEdit ? null : { opacity: 0.55 },
                ]}
              />
            </SettingsRow>
            <SettingsRow label="Phone 2" last>
              <Input
                value={details.phone2}
                onChangeText={(t) => editDetails({ phone2: t })}
                maxLength={20}
                keyboardType="phone-pad"
                editable={canEdit}
                accessibilityLabel="Phone 2"
                style={[
                  {
                    backgroundColor: p.card,
                    borderColor: p.input,
                    color: p.foreground,
                  },
                  canEdit ? null : { opacity: 0.55 },
                ]}
              />
            </SettingsRow>
            {canEdit ? (
              <View
                className="items-end border-t px-4 py-3"
                style={{ borderColor: p.border }}
              >
                <Button
                  label="Save details"
                  icon="save"
                  onPress={() =>
                    void run(
                      () => saveCompany(details),
                      "Company details saved.",
                    )
                  }
                  loading={busy}
                  disabled={!details.name.trim()}
                />
              </View>
            ) : null}
          </Panel>
        </Section>

        <Section
          title="Document numbering"
          description="One format for all years — each financial year restarts the sequence at 1 automatically."
        >
          {numbering ? (
            <MorphGroup>
              <NumberingGroup
                type="sales"
                value={numbering.sales}
                disabled={!canEdit}
                onChange={(v) => editNumbering({ sales: v })}
              />
              <NumberingGroup
                type="outward"
                value={numbering.outward}
                disabled={!canEdit}
                onChange={(v) => editNumbering({ outward: v })}
              />
              <NumberingGroup
                type="packing_s"
                value={numbering.packing_s}
                disabled={!canEdit}
                onChange={(v) => editNumbering({ packing_s: v })}
              />
              <NumberingGroup
                type="packing_j"
                value={numbering.packing_j}
                disabled={!canEdit}
                onChange={(v) => editNumbering({ packing_j: v })}
              />
              <NumberingGroup
                type="raw"
                value={numbering.raw}
                disabled={!canEdit}
                onChange={(v) => editNumbering({ raw: v })}
              />
              {canEdit ? (
                <View className="self-start">
                  <Button
                    label="Save numbering"
                    icon="save"
                    onPress={() =>
                      void run(
                        () => saveNumbering(numbering),
                        "Numbering saved.",
                      )
                    }
                    loading={busy}
                  />
                </View>
              ) : null}
            </MorphGroup>
          ) : (
            <View className="gap-3" aria-hidden>
              <Skeleton className="h-44 rounded-lg" />
              <Skeleton className="h-44 rounded-lg" />
              <Skeleton className="h-44 rounded-lg" />
            </View>
          )}
        </Section>

        <Section
          title="Financial years"
          description="Indian financial years (Apr 1 – Mar 31). Years are created automatically when the first challan falls in them — nothing to set up."
        >
          <Panel>
            {currentFy ? (
              <View
                className={cn(
                  "min-h-[44px] flex-row items-center justify-between gap-4 px-4 py-2.5",
                  financialYears.length > 0 && "border-b",
                )}
                style={{ borderColor: p.border }}
              >
                <Text
                  className="flex-1 text-[14px] font-medium"
                  style={{ color: p.foreground }}
                >
                  Current year
                </Text>
                <View className="shrink-0 flex-row items-center gap-2.5">
                  <Text
                    className="text-xs tabular-nums"
                    style={{ color: p.mutedForeground }}
                  >
                    {fmtDate(currentFy.startsAt)} – {fmtDate(currentFy.endsAt)}
                  </Text>
                  <Badge label={currentFy.label} tone="accent" />
                </View>
              </View>
            ) : null}
            {financialYears.map((fy, i) => (
              <View
                key={fy.label}
                className={cn(
                  "min-h-[44px] flex-row items-center justify-between gap-4 px-4 py-2.5",
                  i < financialYears.length - 1 && "border-b",
                )}
                style={{ borderColor: p.border }}
              >
                <Text
                  className="text-[14px] font-medium tabular-nums"
                  style={{ color: p.foreground }}
                >
                  {fy.label}
                </Text>
                <Text
                  className="text-xs tabular-nums"
                  style={{ color: p.mutedForeground }}
                >
                  {fmtDate(fy.startsAt)} – {fmtDate(fy.endsAt)}
                </Text>
              </View>
            ))}
          </Panel>
        </Section>

        <Section
          title="Appearance"
          description="Choose the theme used across the app on this device."
        >
          <Panel>
            <SettingsRow
              label="Theme"
              hint="Follows the system until you pick one."
              last
            >
              <ThemeRow />
            </SettingsRow>
          </Panel>
        </Section>

        <Section title="About">
          <Panel>
            <SettingsRow label="Version">
              <Text
                className="text-[13px] font-semibold tabular-nums"
                style={{ color: p.primary, fontFamily: "monospace" }}
              >
                v{appVersion()}
              </Text>
            </SettingsRow>
            <UpdateRow />
          </Panel>
        </Section>
      </ScrollView>
    </Screen>
  );
}

export default function SettingsRoute() {
  const status = useAuth((s) => s.status);
  const can = usePermission();
  const router = useRouter();
  const allowed = can("manage_settings");

  // Same contract as web ProtectedRoute: guest → sign-in, permission miss →
  // home (the "/" gate routes packer-only accounts to packing).
  useEffect(() => {
    if (status === "guest") router.replace("/auth");
    else if (status === "authed" && !allowed) router.replace("/");
  }, [status, allowed, router]);

  if (status !== "authed" || !allowed) return null;
  return <SettingsPage />;
}
