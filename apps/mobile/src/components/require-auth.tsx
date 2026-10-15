/**
 * Route guards — the phone mirror of the web app's ProtectedRoute /
 * GuestRoute. `next` is an expo-router param instead of a query string, and
 * only same-origin absolute paths survive the safe-path check.
 */
import type { ReactNode } from "react";
import { Redirect } from "expo-router";
import { useAuth } from "@kataria-syntex/app-core";
import { safeNextPath } from "@kataria-syntex/shared";

import { Splash } from "@/components/splash";

export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuth((s) => s.status);
  if (status === "loading") return <Splash />;
  if (status === "guest") return <Redirect href="/auth" />;
  return <>{children}</>;
}

/** Sign-in-only surface. A signed-in user who lands on `/auth` (back button,
 *  stale link, a QR deep link that already completed) goes straight on — with
 *  the `next` destination when the link carried one. */
export function RequireGuest({
  children,
  next,
}: {
  children: ReactNode;
  next?: string | null;
}) {
  const status = useAuth((s) => s.status);
  if (status === "loading") return <Splash />;
  if (status === "authed") {
    const target = safeNextPath(next ?? null);
    // The router's typed routes only know the app's own paths; `next` is
    // validated by safeNextPath before it gets here.
    return <Redirect href={target as never} />;
  }
  return <>{children}</>;
}
