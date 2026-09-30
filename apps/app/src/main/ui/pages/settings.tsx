import { Suspense, lazy, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Monitor,
  MonitorSmartphone,
  Moon,
  Palette,
  RefreshCw,
  Search,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { useUpdates } from "@/store/updates";
import { isPlainBrowser } from "@/lib/platform";
import { useTheme, type ThemePreference } from "@/ui/hooks/use-theme";
import { SettingsWindow } from "@/ui/components/settings-window";
import { Skeleton } from "@/ui/components/motion";
import { Button } from "@/ui/components/ui/button";
import { Card } from "@/ui/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/ui/components/ui/input-group";
import { Label } from "@/ui/components/ui/label";
import { ProgressBar } from "@/ui/components/progress-bar";
import { cn } from "@/ui/lib/cn";

type SectionId = "appearance" | "updates" | "devices";

const SECTION_ORDER: SectionId[] = ["appearance", "updates", "devices"];

const SECTION_META: Record<
  SectionId,
  { label: string; description: string; icon: LucideIcon; keywords: string }
> = {
  appearance: {
    label: "Appearance",
    description: "Theme for this device.",
    icon: Palette,
    keywords: "theme dark light system display",
  },
  updates: {
    label: "Updates",
    description: "Version and new releases.",
    icon: RefreshCw,
    keywords: "version update upgrade release about",
  },
  devices: {
    label: "Devices",
    description: "Signed-in sessions on this account.",
    icon: MonitorSmartphone,
    keywords: "devices sessions login approve revoke",
  },
};

const DevicesPanel = lazy(() =>
  import("@/ui/components/devices-panel").then((m) => ({
    default: m.DevicesPanel,
  })),
);

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
    <Card className="overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <div className="text-sm font-semibold">Theme</div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Applies on this device only.
        </p>
      </div>
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
                  : "border-border bg-card [@media(hover:hover)]:hover:bg-muted/60",
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <opt.icon className="size-4" aria-hidden />
                {opt.label}
              </span>
              <span
                className={cn(
                  "text-xs",
                  active
                    ? "text-accent-foreground/80"
                    : "text-muted-foreground",
                )}
              >
                {opt.hint}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function UpdatesPanel() {
  return (
    <Card>
      <SettingsRow label="Version">
        <span className="font-mono text-[13px] font-semibold tabular-nums text-primary">
          v{__APP_VERSION__}
        </span>
      </SettingsRow>
      <UpdateRow />
    </Card>
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
        <Label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </Label>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** "Check for updates" row — manual check, plus the deliberate install action
 * only on hosts that need one (macOS dmg, Android APK, Windows/Linux restart).
 * Web needs no action at all: index.html revalidates on every navigation, so
 * the fresh shell arrives on the next load with no prompt and no reload. */
function UpdateRow() {
  const checkNow = useUpdates((s) => s.checkNow);
  const installUpdate = useUpdates((s) => s.installUpdate);
  const latestVersion = useUpdates((s) => s.latestVersion);
  const checking = useUpdates((s) => s.checking);
  const status = useUpdates((s) => s.status);
  const progress = useUpdates((s) => s.progress);
  const [result, setResult] = useState<string | null>(null);

  const web = isPlainBrowser();
  const installable = !web && latestVersion !== null && status === "ready";
  const downloading = status === "downloading";
  // A deploy streaming on web is a readout, not an action — there is nothing
  // to install.
  const showAction = installable || (downloading && !web);

  const check = async () => {
    setResult(null);
    const outcome = await checkNow();
    setResult(
      outcome === "up-to-date"
        ? "You're on the latest version."
        : outcome === "error"
          ? "Couldn't reach the update service."
          : web
            ? "A new version is ready — it applies the next time you open the app."
            : null,
    );
  };

  return (
    <SettingsRow label="Updates" hint={result ?? undefined}>
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
            size="sm"
            className="h-8 shrink-0"
            onClick={() => void installUpdate()}
            disabled={downloading}
            loading={downloading}
          >
            {downloading ? "Downloading…" : "Update"}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-8 shrink-0"
            onClick={() => void check()}
            disabled={checking}
            loading={checking}
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Check
          </Button>
        )}
      </div>
    </SettingsRow>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [section, setSection] = useState<SectionId>("appearance");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return SECTION_ORDER;
    return SECTION_ORDER.filter((id) =>
      `${SECTION_META[id].label} ${SECTION_META[id].description} ${SECTION_META[id].keywords}`
        .toLowerCase()
        .includes(needle),
    );
  }, [query]);

  const active = SECTION_META[section];

  return (
    <SettingsWindow
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) return;
        // The route renders only the window on desktop — closing it must land
        // on a real page, not an empty content area at /settings. A direct
        // landing on the URL (typed, deep link) has no history to pop, and a
        // no-op back there would leave the shell blank until the next nav.
        if (window.history.length > 1) navigate(-1);
        else navigate("/", { replace: true });
      }}
      label="Settings"
    >
      {/* Desktop: sidebar + detail share the window body — the sidebar holds
          its place while only the detail scrolls. Mobile: stacked page flow
          inside the shell's own scroller (PageTransition supplies padding). */}
      <div className="flex min-h-0 flex-1 overflow-hidden max-md:block max-md:overflow-visible">
        <aside
          aria-label="Settings sections"
          className="flex w-60 shrink-0 flex-col gap-3 overflow-y-auto border-r border-border p-3 max-md:w-full max-md:overflow-visible max-md:border-r-0 max-md:border-b max-md:p-0 max-md:pb-4"
        >
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <Search className="size-4 text-muted-foreground" aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search settings"
              aria-label="Search settings"
            />
          </InputGroup>
          <nav aria-label="Settings sections" className="flex flex-col gap-0.5">
            {filtered.map((id) => {
              const meta = SECTION_META[id];
              const selected = id === section;
              const Icon = meta.icon;
              return (
                <button
                  key={id}
                  type="button"
                  aria-current={selected}
                  onClick={() => setSection(id)}
                  className={cn(
                    "btn-motion flex min-h-11 items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] touch-44",
                    selected
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground [@media(hover:hover)]:hover:bg-muted [@media(hover:hover)]:hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{meta.label}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-2.5 py-3 text-[13px] text-muted-foreground">
                Nothing matches “{query}”.
              </p>
            )}
          </nav>
        </aside>

        <div className="settings-window-scroll min-w-0 flex-1 px-6 pb-8 pt-6 max-md:overflow-visible max-md:p-0 max-md:pt-4 md:px-8">
          <div className="px-1">
            <h1 className="text-[15px] font-semibold leading-[1.3] tracking-[-0.01em] sm:text-base">
              {active.label}
            </h1>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              {active.description}
            </p>
          </div>
          <div className="mt-4">
            {section === "appearance" && <AppearancePanel />}
            {section === "updates" && <UpdatesPanel />}
            {section === "devices" && (
              <Suspense
                fallback={
                  <div aria-hidden className="space-y-2">
                    <Skeleton className="h-16 rounded-lg" />
                    <Skeleton className="h-16 rounded-lg" />
                    <Skeleton className="h-16 rounded-lg" />
                  </div>
                }
              >
                <DevicesPanel />
              </Suspense>
            )}
          </div>
        </div>
      </div>
    </SettingsWindow>
  );
}
