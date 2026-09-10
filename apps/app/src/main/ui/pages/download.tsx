/**
 * Download / get-the-app page — public surface for staff onboarding and the
 * macOS redownload flow. Reads the same published manifest the updaters use
 * (latest.json from /releases), so it never needs its own deploy.
 *
 * Artifacts download in-page (fetch → blob → object URL), not via a plain
 * navigation: a stale service worker's SPA fallback could otherwise answer
 * the /releases navigation with index.html and the user saves HTML as
 * .exe/.apk. The in-page fetch never triggers a navigation fallback, the
 * content-type is verified before saving, and progress (percent · size ·
 * ETA) shows on the card.
 *
 * OS detection only picks the recommended card; every platform stays
 * clickable (detection can be wrong).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Download } from "lucide-react";
import { COMPANY_DETAILS, formatUpdateProgress } from "@kataria-syntex/shared";
import {
  apiOrigin,
  createEtaEstimator,
  toastError,
  type UpdateProgress,
} from "@kataria-syntex/app-core";
import { Button } from "@/ui/components/ui/button";
import { Card, CardContent } from "@/ui/components/ui/card";
import { EntryWash } from "@/ui/components/entry-wash";
import {
  AndroidGlyph,
  AppleGlyph,
  LinuxGlyph,
  WindowsGlyph,
} from "@/ui/components/brand-icons";
import { EASE_OUT } from "@/ui/lib/motion";
import { cn } from "@/ui/lib/cn";

type PlatformKey = "win" | "mac" | "linux" | "android";

type ReleaseInfo = {
  version: string;
  releasedAt: string | null;
  paths: Partial<Record<PlatformKey, string>>;
};

const MANIFEST_URL = `${apiOrigin()}/releases/app/android/latest.json`;

async function fetchRelease(): Promise<ReleaseInfo | null> {
  try {
    const res = await fetch(MANIFEST_URL, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    if (body === null || typeof body !== "object") return null;
    const rec = body as Record<string, unknown>;
    if (typeof rec.version !== "string") return null;
    const android = rec.android as { apk?: unknown } | undefined;
    const desktop = rec.desktop as Record<string, unknown> | undefined;
    const pick = (v: unknown): string | undefined =>
      typeof v === "string" && v.startsWith("/releases/") ? v : undefined;
    return {
      version: rec.version,
      releasedAt: typeof rec.releasedAt === "string" ? rec.releasedAt : null,
      paths: {
        android: pick(android?.apk),
        win: pick(desktop?.win),
        mac: pick(desktop?.mac),
        linux: pick(desktop?.linux),
      },
    };
  } catch {
    return null;
  }
}

/** Best-effort platform guess for the recommended card. */
function detectPlatform(): PlatformKey {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad/i.test(ua)) return "mac";
  if (/mac/i.test(ua)) return "mac";
  if (/win/i.test(ua)) return "win";
  if (/linux/i.test(ua)) return "linux";
  return "win";
}

const PLATFORM_META: Record<
  PlatformKey,
  { name: string; file: string; note: string; icon: typeof WindowsGlyph }
> = {
  win: {
    name: "Windows",
    file: "Setup .exe",
    note: 'Unsigned — SmartScreen: "More info → Run anyway".',
    icon: WindowsGlyph,
  },
  mac: {
    name: "macOS",
    file: "Apple Silicon .dmg",
    note: "Right-click the app → Open on first launch.",
    icon: AppleGlyph,
  },
  linux: {
    name: "Linux",
    file: "AppImage",
    note: "chmod +x, then run.",
    icon: LinuxGlyph,
  },
  android: {
    name: "Android",
    file: "APK (all devices)",
    note: 'Allow "Install unknown apps" once.',
    icon: AndroidGlyph,
  },
};

function filenameFrom(href: string): string {
  const last = href.split("/").pop() ?? "download";
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

/** The SPA fallback answered — a stale service worker is controlling this
 * page. Never save a web page as the artifact. */
class HtmlResponseError extends Error {}

/** Streams the artifact into memory with live progress, verifies the server
 * did not answer with a web page, and saves it under its real name. */
async function downloadArtifact(
  href: string,
  onProgress: (progress: UpdateProgress) => void,
): Promise<void> {
  const res = await fetch(href);
  if (!res.ok || !res.body) throw new Error("download_failed");
  const type = (res.headers.get("content-type") ?? "").toLowerCase();
  if (type.startsWith("text/html")) throw new HtmlResponseError();
  const total = Number(res.headers.get("content-length")) || 0;
  const etaFrom = createEtaEstimator();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      bytes += value.length;
      onProgress({
        percent: total > 0 ? Math.min(100, (bytes / total) * 100) : 0,
        transferredBytes: bytes,
        totalBytes: total,
        etaSeconds: etaFrom.sample(bytes, total),
      });
    }
  }
  const blob = new Blob(chunks as BlobPart[], {
    type: type || "application/octet-stream",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filenameFrom(href);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function PlatformCard({
  platform,
  href,
  recommended,
  busy,
  progress,
  onDownload,
}: {
  platform: PlatformKey;
  href: string | null;
  recommended: boolean;
  busy: boolean;
  progress: UpdateProgress | null;
  onDownload: (href: string) => void;
}) {
  const meta = PLATFORM_META[platform];
  const Icon = meta.icon;
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.24, ease: EASE_OUT }}
    >
      <Card
        className={cn(
          "glass-card shadow-soft overflow-hidden transition-colors",
          recommended && "border-accent/40",
        )}
      >
        <CardContent className="flex items-center gap-4 p-4">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
            <Icon className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold leading-none tracking-tight">
                {meta.name}
              </span>
              {recommended && (
                <span className="rounded-sm border border-accent/25 bg-accent/10 px-1.5 py-0.5 text-[11px] font-medium text-accent-foreground">
                  This device
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {progress
                ? formatUpdateProgress(progress)
                : `${meta.file} · ${meta.note}`}
            </p>
          </div>
          {href ? (
            <Button
              variant={recommended ? "default" : "outline"}
              disabled={busy}
              loading={busy && progress === null}
              onClick={() => onDownload(href)}
            >
              <Download className="size-4" aria-hidden />
              {busy && progress
                ? `${Math.round(progress.percent)}%`
                : busy
                  ? "Starting…"
                  : "Download"}
            </Button>
          ) : (
            <Button variant="outline" disabled={busy}>
              Unavailable
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function DownloadPage() {
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [platform] = useState<PlatformKey>(() => detectPlatform());
  const [busyPlatform, setBusyPlatform] = useState<PlatformKey | null>(null);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const aliveRef = useRef(true);
  const etaFrom = useRef(createEtaEstimator());

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void fetchRelease().then((r) => {
      if (alive) {
        setRelease(r);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const download = useCallback(async (key: PlatformKey, href: string) => {
    setBusyPlatform(key);
    setProgress(null);
    etaFrom.current.reset();
    try {
      await downloadArtifact(href, (p) => {
        if (aliveRef.current) setProgress(p);
      });
    } catch (err) {
      if (aliveRef.current) {
        toastError(
          "Download failed",
          err instanceof HtmlResponseError
            ? "The link returned a web page instead of the file. Update the app and try again."
            : "The file couldn't be downloaded. Check your connection and try again.",
        );
      }
    } finally {
      if (aliveRef.current) {
        setBusyPlatform(null);
        setProgress(null);
      }
    }
  }, []);

  const url = (p: PlatformKey): string | null => {
    const path = release?.paths[p];
    return path ? `${apiOrigin()}${path}` : null;
  };

  return (
    <div className="entry-stage flex min-h-dvh flex-col items-center bg-background px-4 py-10 sm:px-6">
      <EntryWash />
      <div className="flex w-full max-w-md flex-col items-center gap-6 sm:max-w-lg">
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

        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Get the app</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? "Checking the latest version…"
              : release
                ? `Latest version ${release.version}`
                : "Release info is unavailable right now."}
          </p>
        </div>

        <div className="flex w-full flex-col gap-3">
          {(["win", "mac", "linux", "android"] as const).map((p) => (
            <PlatformCard
              key={p}
              platform={p}
              href={url(p)}
              recommended={p === platform}
              busy={busyPlatform !== null}
              progress={busyPlatform === p ? progress : null}
              onDownload={(href) => void download(p, href)}
            />
          ))}
        </div>

        <Button asChild variant="link" className="min-h-11">
          <Link to="/auth">
            Continue to sign in
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  );
}
