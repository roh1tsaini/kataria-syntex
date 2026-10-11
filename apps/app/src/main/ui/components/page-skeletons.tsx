import { Skeleton } from "@/ui/components/motion";

/**
 * Route-level loading skeletons. One skeleton per screen, mirroring that
 * screen's real layout (design.md Section 3.1): the shell renders these inside its
 * existing page gutter while a route chunk loads, so chrome never flashes.
 */

/** PageHeader shape: eyebrow + clamp title + description left, action right. */
function PageHeaderSkeleton({
  desc = true,
  actions = true,
  actionsCount = 1,
}: {
  desc?: boolean;
  actions?: boolean;
  actionsCount?: number;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-1.5 h-8 w-56" />
        {desc && <Skeleton className="mt-2 h-3 w-72" />}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:pb-1">
          {Array.from({ length: actionsCount }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-11 w-32 rounded-full sm:h-10 touch-44"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="flex gap-4">
      <div className="hidden w-60 shrink-0 flex-col gap-2 md:flex">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-1 h-3 w-72" />
        <Skeleton className="mt-4 h-44 w-full rounded-lg" />
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
          <div
            key={i}
            className="flex items-center gap-3 border-b border-border py-3 last:border-b-0"
          >
            <Skeleton className="size-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-1.5 h-3 w-56" />
            </div>
            <Skeleton className="size-11 shrink-0 rounded-full sm:h-10 sm:w-24 touch-44" />
          </div>
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
 * Maps a shell pathname to the skeleton shaped like that screen.
 */
export function routeSkeleton(pathname: string): React.ReactNode {
  if (pathname === "/") return <div className="min-h-[60vh]" />;
  switch (pathname) {
    case "/settings":
      return <SettingsSkeleton />;
    case "/devices":
      return <DevicesSkeleton />;
  }
  return (
    <>
      <PageHeaderSkeleton />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </>
  );
}
