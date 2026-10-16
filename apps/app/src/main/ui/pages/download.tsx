/**
 * Public browser download page. The published release manifest supplies every
 * installer URL, while the browser owns the file transfer and its progress.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Download, Globe } from "lucide-react";
import { COMPANY_DETAILS } from "@kataria-syntex/shared";
import { apiOrigin } from "@kataria-syntex/app-core";
import { detectDownloadTarget, type DownloadTarget } from "@/lib/platform";
import { Button } from "@/ui/components/ui/button";
import { ThemeSwitch } from "@/ui/components/ui/theme-switch";
import { Card, CardContent } from "@/ui/components/ui/card";
import { Skeleton } from "@/ui/components/motion";
import {
  AndroidGlyph,
  AppleGlyph,
  LinuxGlyph,
  WindowsGlyph,
} from "@/ui/components/brand-icons";
import { cn } from "@/ui/lib/cn";

/** One published build: platform + CPU target where the platform ships more
 *  than one. Windows/Linux carry x64 and arm64; macOS is Apple Silicon only;
 *  Android has one universal ARM APK. */
type DownloadTargetKey =
  | "win-x64"
  | "win-arm64"
  | "mac-arm64"
  | "linux-x64"
  | "linux-arm64"
  | "android";

type TargetMeta = {
  name: string;
  file: string;
  icon: typeof WindowsGlyph;
};

const TARGET_ORDER: readonly DownloadTargetKey[] = [
  "win-x64",
  "win-arm64",
  "mac-arm64",
  "linux-x64",
  "linux-arm64",
  "android",
];

const TARGET_META: Record<DownloadTargetKey, TargetMeta> = {
  "win-x64": {
    name: "Windows",
    file: "x64 · Setup .exe",
    icon: WindowsGlyph,
  },
  "win-arm64": {
    name: "Windows",
    file: "arm64 · Setup .exe",
    icon: WindowsGlyph,
  },
  "mac-arm64": {
    name: "macOS",
    file: "Apple Silicon · .dmg",
    icon: AppleGlyph,
  },
  "linux-x64": {
    name: "Linux",
    file: "x64 · AppImage",
    icon: LinuxGlyph,
  },
  "linux-arm64": {
    name: "Linux",
    file: "arm64 · AppImage",
    icon: LinuxGlyph,
  },
  android: {
    name: "Android",
    file: "Universal APK",
    icon: AndroidGlyph,
  },
};

/** The row a detected device points at. Detection guarantees an arch for
 *  Windows/Linux, and macOS is always Apple Silicon. */
function targetKeyFor(detected: DownloadTarget): DownloadTargetKey {
  if (detected.platform === "android") return "android";
  if (detected.platform === "mac") return "mac-arm64";
  if (detected.platform === "win") {
    return detected.arch === "arm64" ? "win-arm64" : "win-x64";
  }
  return detected.arch === "arm64" ? "linux-arm64" : "linux-x64";
}

type ReleaseInfo = {
  version: string;
  paths: Partial<Record<DownloadTargetKey, string>>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function releasePath(value: unknown): string | undefined {
  return typeof value === "string" && value.startsWith("/releases/")
    ? value
    : undefined;
}

async function fetchRelease(): Promise<ReleaseInfo | null> {
  try {
    const response = await fetch(
      `${apiOrigin()}/releases/app/android/latest.json`,
      {
        cache: "default",
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok) return null;

    const body = asRecord(await response.json());
    if (typeof body?.version !== "string" || body.version.trim() === "") {
      return null;
    }

    const android = asRecord(body.android);
    const desktop = asRecord(body.desktop);
    const win = asRecord(desktop?.win);
    const linux = asRecord(desktop?.linux);

    return {
      version: body.version,
      paths: {
        "win-x64": releasePath(win?.x64),
        "win-arm64": releasePath(win?.arm64),
        "mac-arm64": releasePath(desktop?.mac),
        "linux-x64": releasePath(linux?.x64),
        "linux-arm64": releasePath(linux?.arm64),
        android: releasePath(android?.apk),
      },
    };
  } catch {
    return null;
  }
}

function DownloadAction({
  href,
  label,
  loading,
  releaseLoaded,
  recommended = false,
}: {
  href: string | null;
  label: string;
  loading: boolean;
  releaseLoaded: boolean;
  recommended?: boolean;
}) {
  if (loading) {
    return (
      <Skeleton
        className={cn(
          "h-11 w-24 shrink-0 rounded-full sm:h-10",
          recommended && "w-36",
        )}
      />
    );
  }

  if (!href) {
    return (
      <Button variant="outline" disabled className="shrink-0">
        {releaseLoaded ? "Unavailable" : label}
      </Button>
    );
  }

  return (
    <Button
      asChild
      variant={recommended ? "default" : "outline"}
      className="shrink-0"
    >
      <a href={href} download>
        <Download aria-hidden />
        {label}
      </a>
    </Button>
  );
}

function TargetRow({
  target,
  href,
  loading,
  releaseLoaded,
}: {
  target: DownloadTargetKey;
  href: string | null;
  loading: boolean;
  releaseLoaded: boolean;
}) {
  const meta = TARGET_META[target];
  const Icon = meta.icon;

  return (
    <li className="flex min-h-16 items-center gap-3 px-4 py-2">
      <span className="content-icon-tile">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-tight">
          {meta.name}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
          {meta.file}
        </span>
      </span>
      <DownloadAction
        href={href}
        label="Download"
        loading={loading}
        releaseLoaded={releaseLoaded}
      />
    </li>
  );
}

export function DownloadPage() {
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<DownloadTargetKey | null>(null);

  useEffect(() => {
    let alive = true;
    void detectDownloadTarget().then((detected) => {
      if (alive) setTarget(detected ? targetKeyFor(detected) : null);
    });
    void fetchRelease().then((nextRelease) => {
      if (!alive) return;
      setRelease(nextRelease);
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, []);

  const hrefFor = (key: DownloadTargetKey): string | null => {
    const path = release?.paths[key];
    return path ? `${apiOrigin()}${path}` : null;
  };
  const recommended = target ? TARGET_META[target] : null;
  const otherTargets = TARGET_ORDER.filter((key) => key !== target);

  return (
    <main className="min-h-dvh bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto flex w-full max-w-[40rem] flex-col gap-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-foreground text-background">
              <span
                className="text-lg font-semibold leading-none tracking-tight"
                aria-hidden
              >
                K
              </span>
            </div>
            <div className="text-[17px] font-semibold tracking-tight">
              {COMPANY_DETAILS.name} Biz App
            </div>
          </div>
          <ThemeSwitch />
        </div>

        <header className="space-y-2">
          <h1 className="page-title">Get the app</h1>
          <div
            className="min-h-5 text-sm tabular-nums text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            {loading ? (
              <Skeleton className="mt-1 h-3 w-36" />
            ) : release ? (
              `Latest version ${release.version}`
            ) : (
              "Release info is unavailable right now."
            )}
          </div>
        </header>

        <div className="flex flex-col gap-6" aria-busy={loading}>
          {recommended ? (
            <section className="space-y-3" aria-labelledby="recommended-title">
              <h2
                id="recommended-title"
                className="text-[13px] font-medium text-muted-foreground"
              >
                Recommended for this device
              </h2>
              <Card className="border-accent/40">
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                  <span className="content-icon-tile">
                    <recommended.icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold leading-tight">
                      {recommended.name}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-muted-foreground">
                      {recommended.file}
                    </span>
                  </span>
                  <DownloadAction
                    href={target ? hrefFor(target) : null}
                    label={`Download for ${recommended.name}`}
                    loading={loading}
                    releaseLoaded={release !== null}
                    recommended
                  />
                </CardContent>
              </Card>
              <div className="flex justify-center pt-1">
                <Button
                  asChild
                  variant="link"
                  className="text-muted-foreground"
                >
                  <Link to="/auth" className="gap-1.5 text-[13px]">
                    Use web version
                    <ArrowRight aria-hidden className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </section>
          ) : (
            <Card>
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                <span className="content-icon-tile">
                  <Globe className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-tight">
                    Use the web version
                  </span>
                  <span className="mt-0.5 block text-[13px] text-muted-foreground">
                    Choose an installer or open the web app.
                  </span>
                </span>
                <Button asChild className="shrink-0">
                  <Link to="/auth">
                    Open web app
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <section
            className="space-y-3"
            aria-labelledby="other-downloads-title"
          >
            <div className="flex items-center justify-between gap-4">
              <h2
                id="other-downloads-title"
                className="text-[15px] font-semibold tracking-tight"
              >
                {recommended ? "Other devices" : "Available downloads"}
              </h2>
            </div>
            <Card>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {otherTargets.map((key) => (
                    <TargetRow
                      key={key}
                      target={key}
                      href={hrefFor(key)}
                      loading={loading}
                      releaseLoaded={release !== null}
                    />
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </main>
  );
}
