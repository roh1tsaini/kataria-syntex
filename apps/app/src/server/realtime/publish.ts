/**
 * Realtime publish — how a write tells the workspace "data changed".
 *
 * One fire-and-forget stub call to the workspace's RealtimeRoom per write
 * path. The waitUntil wrapper keeps the publish off the response's critical
 * path and lets the Worker outlive the response to complete it.
 */

import type { Env } from "../env";
import type { RealtimeEntity } from "@kataria-syntex/shared";

/**
 * Broadcasts refresh hints to the workspace's live sockets. Never throws,
 * never delays the response: realtime is an upgrade, and its failure is
 * invisible (clients fall back to their normal poll paths).
 */
export function publishChanges(
  env: Env,
  ctx: { waitUntil: (p: Promise<unknown>) => void },
  workspaceId: string,
  fromClientId: string | null | undefined,
  entities: RealtimeEntity[],
): void {
  try {
    const id = env.REALTIME.idFromName(workspaceId);
    const stub = env.REALTIME.get(id);
    const promise = stub
      .fetch("https://realtime/publish", {
        method: "POST",
        body: JSON.stringify({ entities, from: fromClientId }),
      })
      .then(() => undefined)
      .catch(() => undefined);
    ctx.waitUntil(promise);
  } catch {
    // No binding (local scripts) or transient error — skip silently.
  }
}
