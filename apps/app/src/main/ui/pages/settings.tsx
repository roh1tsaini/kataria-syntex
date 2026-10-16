import { Suspense, lazy, useEffect, useState } from "react";
import {
  KeyRound,
  Monitor,
  MonitorSmartphone,
  Moon,
  Palette,
  RefreshCw,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { UPDATE_FAILURE_COPY, useUpdates } from "@/store/updates";
import { isPlainBrowser, updateAction } from "@/lib/platform";
import { useTheme, type ThemePreference } from "@/ui/hooks/use-theme";
import { Skeleton } from "@/ui/components/motion";
import { Button } from "@/ui/components/ui/button";
import { Card } from "@/ui/components/ui/card";
import { Label } from "@/ui/components/ui/label";
import { PageHeader } from "@/ui/components/page-header";
import { ProgressBar } from "@/ui/components/progress-bar";
import { cn } from "@/ui/lib/cn";

const DevicesPanel = lazy(() =>
  import("@/ui/components/devices-panel").then((m) => ({
    default: m.DevicesPanel,
  })),
);

const SecurityPanel = lazy(() =>
  import("@/ui/components/security-panel").then((m) => ({
    default: m.SecurityPanel,
  })),
);

/** One section head — 32px accent tile, name, one muted line, hairline below.
 * Every settings section opens this way, at every width and on every shell. */
function SectionHead({
  icon: Icon,
  label,
  description,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border px-4 py-3.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-sm bg-accent text-accent-foreground">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">{label}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

/** A section card: head, then the panel. All sections stack on one page. */
function Section({
  icon,
  label,
  description,
  children,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <SectionHead icon={icon} label={label} description={description} />
      {children}
    </Card>
  );
}

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  {
    value: "system",
    label: "System",
    hint: "Follows your device",
    icon: Monitor,
  },
  { value: "light", label: "Light", hint: "Bright surfaces", icon: Sun },
  { value: "dark", label: "Dark", hint: "Dim surfaces", icon: Moon },
];

function AppearancePanel() {
  const { preference, setTheme } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="grid gap-2 p-4 sm:grid-cols-3"
    >
      {THEME_OPTIONS.map((opt) => {
        const active = preference === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(opt.value)}
            className={cn(
              "btn-motion flex min-h-11 flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left touch-44",
              active
                ? "border-accent-foreground/30 bg-accent text-accent-foreground"
                : "border-border bg-card [@media(hover:hover)]:hover:bg-muted/60 active:bg-muted/60",
            )}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <opt.icon className="size-4" aria-hidden />
              {opt.label}
            </span>
            <span
              className={cn(
                "text-xs",
                active ? "text-accent-foreground/80" : "text-muted-foreground",
              )}
            >
              {opt.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function UpdatesPanel() {
  return (
    <>
      <SettingsRow label="Version">
        <span className="font-mono text-[13px] font-semibold tabular-nums text-primary">
          v{__APP_VERSION__}
        </span>
      </SettingsRow>
      <UpdateRow />
    </>
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
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-border px-4 py-3 last:border-b-0 sm:min-h-11 sm:flex-row sm:items-center sm:gap-4 sm:py-2">
      <div className="min-w-0 flex-1">
        <Label htmlFor={htmlFor}>{label}</Label>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** Manual check, Retry after failure, and each shell's update action. */
function UpdateRow() {
  const checkNow = useUpdates((s) => s.checkNow);
  const retryUpdate = useUpdates((s) => s.retryUpdate);
  const installUpdate = useUpdates((s) => s.installUpdate);
  const latestVersion = useUpdates((s) => s.latestVersion);
  const checking = useUpdates((s) => s.checking);
  const status = useUpdates((s) => s.status);
  const progress = useUpdates((s) => s.progress);
  const failure = useUpdates((s) => s.failure);
  const [result, setResult] = useState<string | null>(null);
  const [retryInFlight, setRetryInFlight] = useState(false);

  const web = isPlainBrowser();
  const action = updateAction();
  const installable = !web && latestVersion !== null && status === "ready";
  const downloading = status === "downloading";
  const installing = status === "installing";
  const busy = downloading || installing;
  const retrying = failure !== null || retryInFlight;
  // A deploy streaming on web is a readout, not an action — there is nothing
  // to install.
  const showAction = !retryInFlight && (installable || (busy && !web));

  useEffect(() => {
    if (retryInFlight && !checking && !busy) setRetryInFlight(false);
  }, [busy, checking, retryInFlight]);

  const check = async () => {
    setResult(null);
    const outcome = await checkNow();
    setResult(
      outcome === "up-to-date"
        ? "You're on the latest version."
        : outcome === "available" && web
          ? "A new version is ready — it applies the next time you open the app."
          : null,
    );
  };

  const retry = async () => {
    setRetryInFlight(true);
    try {
      await retryUpdate();
    } finally {
      const current = useUpdates.getState();
      if (
        !current.checking &&
        current.status !== "downloading" &&
        current.status !== "installing"
      ) {
        setRetryInFlight(false);
      }
    }
  };

  return (
    <SettingsRow
      label="Updates"
      hint={failure ? UPDATE_FAILURE_COPY[failure] : (result ?? undefined)}
    >
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-center sm:gap-3 sm:[flex-direction:row]">
        {downloading && progress ? (
          <ProgressBar
            percent={progress.percent}
            totalBytes={progress.totalBytes}
            className="w-full min-w-36 sm:w-40"
          />
        ) : installable ? (
          <span className="text-xs tabular-nums text-muted-foreground">
            v{latestVersion} available
          </span>
        ) : null}
        {showAction ? (
          <Button
            className="shrink-0"
            onClick={() => void installUpdate()}
            disabled={busy}
            loading={busy}
          >
            {action === "restart"
              ? "Restart to update"
              : action === "download"
                ? "Download update"
                : "Update"}
          </Button>
        ) : (
          <Button
            variant="outline"
            className="shrink-0"
            onClick={() => void (retrying ? retry() : check())}
            disabled={checking || retryInFlight}
            loading={checking || retryInFlight}
          >
            <RefreshCw className="size-3.5" aria-hidden />
            {retrying ? "Retry" : "Check"}
          </Button>
        )}
      </div>
    </SettingsRow>
  );
}

/** Card-shaped placeholder while a lazily loaded panel chunk arrives. */
function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <div aria-hidden className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-lg" />
      ))}
    </div>
  );
}

export function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-[680px]">
      {/* One centered column of stacked section cards — no navigation, no
          search; every section is visible and the page scrolls in the shell
          scroller like every screen. */}
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Everything for this account, on one page."
      />

      <div className="mt-6 flex flex-col gap-4">
        <Section
          icon={Palette}
          label="Appearance"
          description="Theme for this device."
        >
          <AppearancePanel />
        </Section>

        <Section
          icon={RefreshCw}
          label="Updates"
          description="Version and new releases."
        >
          <UpdatesPanel />
        </Section>

        <Section
          icon={KeyRound}
          label="Security"
          description="Password for this account."
        >
          <Suspense fallback={<RowsSkeleton rows={3} />}>
            <SecurityPanel />
          </Suspense>
        </Section>

        <Suspense
          fallback={
            <Section
              icon={MonitorSmartphone}
              label="Devices"
              description="Signed-in sessions on this account."
            >
              <RowsSkeleton rows={2} />
            </Section>
          }
        >
          <DevicesPanel
            sectionHeader={
              <SectionHead
                icon={MonitorSmartphone}
                label="Devices"
                description="Signed-in sessions on this account."
              />
            }
          />
        </Suspense>
      </div>
    </div>
  );
}
