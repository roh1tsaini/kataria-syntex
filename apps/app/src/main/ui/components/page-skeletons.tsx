import { Skeleton } from "@/ui/components/motion";
import { cn } from "@/ui/lib/cn";

/**
 * Route-level loading skeletons. One skeleton per screen, mirroring that
 * screen's real layout (design.md Section 3.1): the shell renders these inside its
 * existing page gutter while a route chunk loads, so chrome never flashes.
 */

/** PageHeader shape: eyebrow + clamp title + description left, action right. */
function PageHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-1.5 h-8 w-56" />
        <Skeleton className="mt-2 h-3 w-72" />
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:pb-1">
        <Skeleton className="h-11 w-32 rounded-full sm:h-10 touch-44" />
      </div>
    </div>
  );
}

/** One device row, shared with the devices panel's own loading state. */
export function DeviceRowSkeleton({
  padded = false,
  action = true,
}: {
  padded?: boolean;
  action?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 border-b py-3 last:border-b-0",
        padded
          ? "items-start border-border/65 px-4 sm:px-5"
          : "items-center border-border",
      )}
    >
      <Skeleton className="size-10 shrink-0 rounded-lg" />
      <div className={cn("min-w-0 flex-1", padded && "space-y-2")}>
        <Skeleton className="h-4 w-40" />
        <Skeleton className={padded ? "h-3 w-52" : "mt-1.5 h-3 w-56"} />
      </div>
      {action && (
        <Skeleton className="size-11 shrink-0 rounded-full sm:h-10 sm:w-24 touch-44" />
      )}
    </div>
  );
}

/** One centered column of stacked section cards (settings.tsx). */
function SettingsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[680px]">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-1.5 h-3 w-64" />
      <div className="mt-6 flex flex-col gap-4">
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-44 w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-lg" />
        <Skeleton className="h-60 w-full rounded-lg" />
      </div>
    </div>
  );
}

function DevicesSkeleton() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="mt-6 rounded-lg border border-border bg-card p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <DeviceRowSkeleton key={i} />
        ))}
      </div>
    </>
  );
}

/* Standalone routes (outside the shell) ------------------------------------ */

export function AuthSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 rounded-xl" />
        <Skeleton className="h-5 w-44" />
      </div>
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-border bg-card sm:max-w-2xl">
        <div className="p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-3 w-64" />
          <div className="mt-6 space-y-4">
            <div
              aria-hidden
              className="grid grid-cols-2 gap-1 rounded-full border border-border bg-muted p-1 sm:hidden"
            >
              <Skeleton className="h-11 rounded-full" />
              <Skeleton className="h-11 rounded-full" />
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-11 w-full rounded-full sm:h-10 touch-44" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ScanApproveSkeleton() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-11 w-full rounded-full sm:h-10 touch-44" />
      </div>
    </div>
  );
}

/* Route mapping ------------------------------------------------------------ */

/**
 * The shell's screens — the one route set App.tsx's router and the skeleton
 * map below are typed against. A new route fails typecheck until
 * `SHELL_SKELETONS` has its skeleton, so no shell screen can ship without one.
 */
export const SHELL_ROUTES = ["/", "/devices", "/settings"] as const;

export type ShellRoute = (typeof SHELL_ROUTES)[number];

const SHELL_SKELETONS: Record<ShellRoute, React.ReactNode> = {
  "/": <div className="min-h-[60vh]" />,
  "/devices": <DevicesSkeleton />,
  "/settings": <SettingsSkeleton />,
};

/** `/devices/` resolves to the same screen as `/devices`; `/` stays `/`. */
function normalizePathname(pathname: string): string {
  const stripped = pathname.replace(/\/+$/, "");
  return stripped === "" ? "/" : stripped;
}

function isShellRoute(pathname: string): pathname is ShellRoute {
  return SHELL_ROUTES.some((route) => route === pathname);
}

/** Maps a shell pathname to the skeleton shaped like that screen (design.md
 * Section 3.1). Outside the shell route set (standalone route, 404) there is
 * no page to shape, so nothing renders. */
export function routeSkeleton(pathname: string): React.ReactNode {
  const normalized = normalizePathname(pathname);
  if (!isShellRoute(normalized)) return undefined;
  return SHELL_SKELETONS[normalized];
}
