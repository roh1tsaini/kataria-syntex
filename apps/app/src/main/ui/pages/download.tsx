/**
 * Public browser download page. The published release manifest supplies every
 * installer URL, while the browser owns the file transfer and its progress.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Download, Globe, Moon, Sun } from "lucide-react";
import { COMPANY_DETAILS } from "@kataria-syntex/shared";
import { apiOrigin } from "@kataria-syntex/app-core";
import { detectPlatformKey, type DownloadPlatformKey } from "@/lib/platform";
import { useTheme } from "@/ui/hooks/use-theme";
import { Button } from "@/ui/components/ui/button";
import { CircleButton } from "@/ui/components/ui/circle-button";
import { Card, CardContent } from "@/ui/components/ui/card";
import { Skeleton } from "@/ui/components/motion";
import {
  AndroidGlyph,
  AppleGlyph,
  LinuxGlyph,
  WindowsGlyph,
} from "@/ui/components/brand-icons";
import { cn } from "@/ui/lib/cn";

type PlatformMeta = {
  name: string;
  file: string;
  icon: typeof WindowsGlyph;
};

const PLATFORM_ORDER: readonly DownloadPlatformKey[] = [
  "win",
  "mac",
  "linux",
  "android",
];

const PLATFORM_META: Record<DownloadPlatformKey, PlatformMeta> = {
  win: {
    name: "Windows",
    file: "x64 · Setup .exe",
    icon: WindowsGlyph,
  },
  mac: {
    name: "macOS",
    file: "Apple Silicon · .dmg",
    icon: AppleGlyph,
  },
  linux: {
    name: "Linux",
    file: "x64 · AppImage",
    icon: LinuxGlyph,
  },
  android: {
    name: "Android",
    file: "Universal APK",
    icon: AndroidGlyph,
  },
};

type ReleaseInfo = {
  version: string;
  paths: Partial<Record<DownloadPlatformKey, string>>;
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

    return {
      version: body.version,
      paths: {
        android: releasePath(android?.apk),
        win: releasePath(desktop?.win),
        mac: releasePath(desktop?.mac),
        linux: releasePath(desktop?.linux),
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

function PlatformRow({
  platform,
  href,
  loading,
  releaseLoaded,
}: {
  platform: DownloadPlatformKey;
  href: string | null;
  loading: boolean;
  releaseLoaded: boolean;
}) {
  const meta = PLATFORM_META[platform];
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
  const [platform, setPlatform] = useState<DownloadPlatformKey | null>(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    let alive = true;
    void detectPlatformKey().then((detectedPlatform) => {
      if (alive) setPlatform(detectedPlatform);
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

  const hrefFor = (key: DownloadPlatformKey): string | null => {
    const path = release?.paths[key];
    return path ? `${apiOrigin()}${path}` : null;
  };
  const recommended = platform ? PLATFORM_META[platform] : null;
  const otherPlatforms = PLATFORM_ORDER.filter((key) => key !== platform);

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
          <CircleButton
            onClick={toggleTheme}
            title={theme === "dark" ? "Light theme" : "Dark theme"}
            aria-label={theme === "dark" ? "Light theme" : "Dark theme"}
          >
            {theme === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
          </CircleButton>
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
                    href={platform ? hrefFor(platform) : null}
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
                  {otherPlatforms.map((key) => (
                    <PlatformRow
                      key={key}
                      platform={key}
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
