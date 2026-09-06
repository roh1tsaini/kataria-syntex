import { useEffect, useState, type ReactNode } from "react";
import { Save } from "lucide-react";
import {
  useAuth,
  usePermission,
  type Numbering,
  type NumberingType,
} from "@/store/auth";
import { friendlyError } from "@/ui/lib/errors";
import { fmtDate } from "@/ui/lib/format";
import { toastError, toastSuccess } from "@/store/toast";
import { AppShell } from "@/ui/components/app-shell";
import { PageHeader } from "@/ui/components/page-header";
import { Button } from "@/ui/components/ui/button";
import { Input } from "@/ui/components/ui/input";
import { Label } from "@/ui/components/ui/label";
import { Card } from "@/ui/components/ui/card";
import { Badge } from "@/ui/components/ui/badge";
import { Skeleton } from "@/ui/components/motion";
import { AccentPicker } from "@/ui/components/accent-picker";

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

/** iOS-style grouped section: header copy above a 12px-radius card of rows. */
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="px-1">
        <h2 className="text-[15px] font-semibold leading-[1.3] tracking-[-0.01em]">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** One grouped row — label (+optional hint) left, control right, ≥44px tall. */
function SettingsRow({
  htmlFor,
  label,
  hint,
  children,
}: {
  htmlFor?: string;
  label: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-border px-4 py-3 last:border-b-0 sm:min-h-11 sm:flex-row sm:items-center sm:gap-4 sm:py-2">
      <div className="min-w-0 flex-1">
        <Label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </Label>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
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
  const preview = `${value.prefix}${"1".padStart(value.minDigits, "0")}${value.suffix}`;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{TYPE_LABELS[type]}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {TYPE_HINTS[type]}
          </div>
        </div>
        <span className="shrink-0 rounded-sm bg-muted px-2.5 py-1 font-mono text-[13px] font-semibold text-primary">
          {preview}
        </span>
      </div>
      <div className="border-t border-border">
        <SettingsRow htmlFor={`${type}-prefix`} label="Prefix">
          <Input
            id={`${type}-prefix`}
            value={value.prefix}
            onChange={(e) => onChange({ ...value, prefix: e.target.value })}
            maxLength={10}
            placeholder="CH/"
            disabled={disabled}
            className="h-10 w-full font-mono sm:w-36"
          />
        </SettingsRow>
        <SettingsRow htmlFor={`${type}-digits`} label="Min digits">
          <Input
            id={`${type}-digits`}
            type="number"
            min={1}
            max={6}
            value={value.minDigits}
            onChange={(e) =>
              onChange({
                ...value,
                minDigits: Math.min(
                  6,
                  Math.max(1, Number(e.target.value) || 1),
                ),
              })
            }
            disabled={disabled}
            className="h-10 w-full tabular-nums sm:w-36"
          />
        </SettingsRow>
        <SettingsRow htmlFor={`${type}-suffix`} label="Suffix">
          <Input
            id={`${type}-suffix`}
            value={value.suffix}
            onChange={(e) => onChange({ ...value, suffix: e.target.value })}
            maxLength={10}
            placeholder="/26-27"
            disabled={disabled}
            className="h-10 w-full font-mono sm:w-36"
          />
        </SettingsRow>
      </div>
    </Card>
  );
}

export function SettingsPage() {
  const isPrimaryAdmin = useAuth((s) => s.workspace?.isPrimaryAdmin);
  const can = usePermission();
  const company = useAuth((s) => s.company);
  const currentFy = useAuth((s) => s.currentFy);
  const financialYears = useAuth((s) => s.financialYears);
  const refreshCompany = useAuth((s) => s.refreshCompany);
  const saveCompany = useAuth((s) => s.saveCompany);
  const saveNumbering = useAuth((s) => s.saveNumbering);

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
  // (AppShell, other pages) must not clobber half-typed values.
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    void refreshCompany().catch(() => {});
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
    <AppShell>
      <PageHeader
        eyebrow="Company profile"
        title="Company settings"
        description={
          canEdit
            ? "Your company details and how challan numbers are generated."
            : "Read-only — only the owner can change these settings."
        }
      />

      {error && (
        <p className="mt-4 rounded-lg border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-6">
        <Section
          title="Company details"
          description="Printed on challans and used as your business identity."
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => saveCompany(details), "Company details saved.");
            }}
          >
            <Card className="overflow-hidden">
              <SettingsRow htmlFor="c-name" label="Company name">
                <Input
                  id="c-name"
                  value={details.name}
                  onChange={(e) => editDetails({ name: e.target.value })}
                  required
                  disabled={!canEdit}
                  className="h-10 w-full sm:w-64"
                />
              </SettingsRow>
              <SettingsRow htmlFor="c-gstin" label="GSTIN">
                <Input
                  id="c-gstin"
                  value={details.gstin}
                  onChange={(e) => editDetails({ gstin: e.target.value })}
                  maxLength={15}
                  placeholder="27ABCDE1234F1Z5"
                  disabled={!canEdit}
                  className="h-10 w-full font-mono sm:w-64"
                />
              </SettingsRow>
              <SettingsRow htmlFor="c-pan" label="PAN">
                <Input
                  id="c-pan"
                  value={details.pan}
                  onChange={(e) =>
                    editDetails({ pan: e.target.value.toUpperCase() })
                  }
                  maxLength={10}
                  placeholder="ABCDE1234F"
                  disabled={!canEdit}
                  className="h-10 w-full font-mono sm:w-64"
                />
              </SettingsRow>
              <SettingsRow htmlFor="c-address" label="Address">
                <Input
                  id="c-address"
                  value={details.address}
                  onChange={(e) => editDetails({ address: e.target.value })}
                  maxLength={300}
                  placeholder="Full address"
                  disabled={!canEdit}
                  className="h-10 w-full sm:w-64"
                />
              </SettingsRow>
              <SettingsRow htmlFor="c-phone1" label="Phone 1">
                <Input
                  id="c-phone1"
                  value={details.phone1}
                  onChange={(e) => editDetails({ phone1: e.target.value })}
                  maxLength={20}
                  disabled={!canEdit}
                  className="h-10 w-full sm:w-64"
                />
              </SettingsRow>
              <SettingsRow htmlFor="c-phone2" label="Phone 2">
                <Input
                  id="c-phone2"
                  value={details.phone2}
                  onChange={(e) => editDetails({ phone2: e.target.value })}
                  maxLength={20}
                  disabled={!canEdit}
                  className="h-10 w-full sm:w-64"
                />
              </SettingsRow>
              {canEdit && (
                <div className="flex justify-end border-t border-border px-4 py-3">
                  <Button
                    type="submit"
                    loading={busy}
                    disabled={!details.name.trim()}
                  >
                    <Save aria-hidden />
                    Save details
                  </Button>
                </div>
              )}
            </Card>
          </form>
        </Section>

        <Section
          title="Document numbering"
          description="One format for all years — each financial year restarts the sequence at 1 automatically."
        >
          {numbering ? (
            <div className="flex flex-col gap-3">
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
              {canEdit && (
                <Button
                  className="self-start"
                  loading={busy}
                  onClick={() =>
                    void run(() => saveNumbering(numbering), "Numbering saved.")
                  }
                >
                  <Save aria-hidden />
                  Save numbering
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3" aria-hidden>
              <Skeleton className="h-44 rounded-lg" />
              <Skeleton className="h-44 rounded-lg" />
              <Skeleton className="h-44 rounded-lg" />
            </div>
          )}
        </Section>

        <Section
          title="Financial years"
          description="Indian financial years (Apr 1 – Mar 31). Years are created automatically when the first challan falls in them — nothing to set up."
        >
          <Card>
            {currentFy && (
              <div className="flex min-h-11 items-center justify-between gap-4 border-b border-border px-4 py-2.5 last:border-b-0">
                <span className="text-sm font-medium">Current year</span>
                <span className="flex items-center gap-2.5">
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {fmtDate(currentFy.startsAt)} – {fmtDate(currentFy.endsAt)}
                  </span>
                  <Badge
                    variant="outline"
                    className="border-accent/25 bg-accent/10 text-accent-foreground tabular-nums"
                  >
                    {currentFy.label}
                  </Badge>
                </span>
              </div>
            )}
            {financialYears.map((fy) => (
              <div
                key={fy.label}
                className="flex min-h-11 items-center justify-between gap-4 border-b border-border px-4 py-2.5 last:border-b-0"
              >
                <span className="text-sm font-medium tabular-nums">
                  {fy.label}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {fmtDate(fy.startsAt)} – {fmtDate(fy.endsAt)}
                </span>
              </div>
            ))}
          </Card>
        </Section>

        <Section
          title="Appearance"
          description="Choose the accent colour used across the app on this device."
        >
          <Card>
            <SettingsRow
              label="Accent colour"
              hint="Buttons, links and highlights."
            >
              <AccentPicker />
            </SettingsRow>
          </Card>
        </Section>
      </div>
    </AppShell>
  );
}
