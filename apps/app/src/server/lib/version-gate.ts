/**
 * Per-request version gate — the runtime half of the no-backward-compat
 * contract (AGENTS.md §4.0.1). Every API call carries the client's version in
 * X-App-Version; below minAppVersion the server answers 426 update_required
 * so a stale native client shows the blocking update dialog instead of a
 * pile of parse failures after a breaking deploy.
 *
 * Exempt from the gate: /api/health (updaters poll it before anything
 * else) and /api/auth (a client must always be able to learn WHY it is
 * locked out — and the login screen itself offers the update path).
 */
import type { MiddlewareHandler } from "hono";
import { compareSemver } from "@kataria-syntex/shared";
import type { Env } from "../env";
import { MIN_APP_VERSION, VERSION_GATE_ENABLED } from "./app-version";
import { apiError } from "./api-error";

export const versionGate: MiddlewareHandler<{ Bindings: Env }> = async (
  c,
  next,
) => {
  if (!VERSION_GATE_ENABLED) return next();

  const path = new URL(c.req.raw.url).pathname;
  const exempt =
    path === "/api/health" ||
    path === "/api/auth" ||
    path.startsWith("/api/auth/");
  if (exempt) return next();

  const clientVersion = c.req.header("X-App-Version");
  // No header = pre-gate client (old build) or a curl — same answer: update.
  if (!clientVersion || compareSemver(clientVersion, MIN_APP_VERSION) < 0) {
    return apiError(c, "update_required", 426, {
      minVersion: MIN_APP_VERSION,
    });
  }
  return next();
};
