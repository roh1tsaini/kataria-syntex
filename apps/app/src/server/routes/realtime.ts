/**
 * POST /api/realtime/ticket — mints the one-shot credential a client needs
 * to open the realtime WebSocket.
 *
 * Sessions ride cookies (web), bearer tokens (Android) or the Electron IPC
 * bridge — none of which can add custom headers to a browser WebSocket
 * handshake. So auth happens here over the normal api() path, and the
 * ticket is the only capability the WS URL carries: single-use, one minute,
 * worthless in a log. The hash goes to the room; the raw ticket never
 * touches storage.
 */

import { Hono } from "hono";
import type { Env } from "../env";
import { generateToken, sha256Hex } from "../lib/token";
import { requireAuth } from "../auth/session";
import { resolveMember, type PermsEnv } from "../auth/perms";

export const realtimeRoute = new Hono<PermsEnv & { Bindings: Env }>();

realtimeRoute.use("*", requireAuth, resolveMember());

realtimeRoute.post("/ticket", async (c) => {
  const workspaceId = c.get("member").workspaceId;
  const ticket = generateToken();
  const hash = await sha256Hex(ticket);
  // Echo suppression: the client id rides every request as X-Client-Id
  // (api.ts deviceHeaders). A header-less client gets NO suppression id
  // (publish skips nothing) — a shared fallback id would wrongly suppress
  // echoes between unrelated header-less clients.
  const id = c.env.REALTIME.idFromName(workspaceId);
  const stub = c.env.REALTIME.get(id);
  const res = await stub.fetch("https://realtime/ticket", {
    method: "POST",
    body: JSON.stringify({
      hash,
      clientId: c.req.header("x-client-id") || null,
    }),
  });
  if (res.status !== 204) {
    return c.json({ error: "realtime_ticket_failed" }, 503);
  }
  return c.json({ ticket });
});
