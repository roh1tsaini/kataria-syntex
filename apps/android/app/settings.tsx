/**
 * Settings — the Android port of apps/app's SettingsPage. Company details
 * form, per-type document numbering editor (same fields and clamps as web),
 * financial-years list, accent picker, About with app version and the
 * check-for-updates row, behind the manage_settings gate
 * (web: ProtectedRoute requirePermission="manage_settings").
 */

import { useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
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
import { Badge, Button, Card, Input, Screen, Skeleton } from "@/ui/kit";
import { SyncStrip } from "@/ui/sync";
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
      className={cn("rounded-xl border", className)}
      style={{ backgroundColor: p.card, borderColor: p.border }}
    >
      {children}
    </View>
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
  children,
}: {
  label: string;
  hint?: string;
  children?: ReactNode;
}) {
  const p = usePalette();
  return (
    <View
      className="gap-2 border-b px-4 py-3"
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
    <Panel>
      <View
        className="flex-row items-center justify-between gap-3 px-4 py-3"
        style={{ borderColor: p.border }}
      >
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
      <View style={{ borderColor: p.border }}>
        <SettingsRow label="Prefix">
          <Input
            value={value.prefix}
            onChangeText={(t) => onChange({ ...value, prefix: t })}
            maxLength={10}
            placeholder="CH/"
            autoCapitalize="characters"
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
        <SettingsRow label="Suffix">
          <Input
            value={value.suffix}
            onChangeText={(t) => onChange({ ...value, suffix: t })}
            maxLength={10}
            placeholder="/26-27"
            autoCapitalize="characters"
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
      </View>
    </Panel>
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
    try {
      const outcome = await checkNow();
      setResult(
        outcome === "up-to-date"
          ? "You're on the latest version."
          : outcome === "error"
            ? "Couldn't reach the update service."
            : null,
      );
    } catch {
      setResult("Couldn't reach the update service.");
    }
  };

  const install = async () => {
    setResult(null);
    try {
      await installUpdate();
    } catch {
      setResult("Download failed. Check your connection and try again.");
    }
  };

  return (
    <SettingsRow label="Updates" hint={result ?? undefined}>
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
              onPress={() => void install()}
              disabled={downloading}
              loading={downloading}
              className="min-h-[44px] px-3"
            />
          </View>
        ) : (
          <View className="shrink-0">
            <Button
              label="Check"
              variant="secondary"
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
  const router = useRouter();

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
              className="min-w-0 flex-1 text-[13px]"
              style={{ color: p.destructive }}
            >
              {companyError}
            </Text>
            <Button
              label="Retry"
              variant="secondary"
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
            <Text className="text-[13px]" style={{ color: p.destructive }}>
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
                autoCapitalize="characters"
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
                autoCapitalize="characters"
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
            <SettingsRow label="Phone 2">
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
                className="items-end px-4 py-3"
                style={{ borderColor: p.border }}
              >
                <Button
                  label="Save details"
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
            <View className="gap-3">
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
            </View>
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
                className="flex-row items-center justify-between gap-4 border-b px-4 py-3"
                style={{ borderColor: p.border }}
              >
                <Text
                  className="flex-1 text-[14px] font-medium"
                  style={{ color: p.foreground }}
                >
                  Current year
                </Text>
                <View className="shrink-0 items-end gap-1">
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
            {financialYears.map((fy) => (
              <View
                key={fy.label}
                className="flex-row items-center justify-between gap-4 border-b px-4 py-3"
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
