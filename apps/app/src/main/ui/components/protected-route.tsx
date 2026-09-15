import { type ReactNode } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { COMPANY_DETAILS } from "@kataria-syntex/shared";
import {
  useAuth,
  usePermission,
  type Permission,
} from "@kataria-syntex/app-core";
import { EASE_OUT } from "@/ui/lib/motion";
import { safeNextPath } from "@/ui/lib/next-path";

function Splash() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <motion.div
        initial={{
          opacity: 0,
          scale: reduceMotion ? 1 : 0.96,
        }}
        animate={{ opacity: 1, scale: 1 }}
        transition={
          reduceMotion ? { duration: 0 } : { duration: 0.22, ease: EASE_OUT }
        }
        className="relative grid size-14 place-items-center rounded-xl bg-primary text-primary-foreground"
      >
        <span
          className="text-2xl font-extrabold leading-none tracking-tight"
          aria-hidden
        >
          K
        </span>
        <span className="sr-only">Loading {COMPANY_DETAILS.name} Biz App</span>
      </motion.div>
    </div>
  );
}

export function ProtectedRoute({
  children,
  requirePermission,
}: {
  children: ReactNode;
  requirePermission?: Permission;
}) {
  const status = useAuth((s) => s.status);
  const can = usePermission();
  if (status === "loading") {
    return <Splash />;
  }
  if (status === "guest") return <Navigate to="/auth" replace />;
  if (requirePermission && !can(requirePermission)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

/** Sign-in-only surface. A signed-in user who lands on `/auth` (back button,
 * stale bookmark, a QR deep link that already completed) goes straight on —
 * with the `?next=` destination when the link carried one. */
export function GuestRoute({ children }: { children: ReactNode }) {
  const status = useAuth((s) => s.status);
  const [params] = useSearchParams();
  if (status === "loading") {
    return <Splash />;
  }
  if (status === "authed") {
    return <Navigate to={safeNextPath(params.get("next"))} replace />;
  }
  return <>{children}</>;
}
