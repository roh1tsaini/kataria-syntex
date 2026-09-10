/**
 * RealtimeRoom — one Durable Object per workspace, a pure post office.
 *
 * It holds WebSocket connections and fans out tiny refresh hints; it stores
 * no business data (D1 stays the single source of truth, so the room can be
 * deleted without losing anything). Connections use the hibernation API —
 * idle sockets cost nothing, and client keepalive pings are answered by the
 * runtime's auto-response pair without ever waking this instance.
 *
 * Connect flow: the client fetches a one-shot ticket over the normal
 * authenticated API (cookie / bearer / Electron IPC all work), then opens
 * the WebSocket with that ticket. The room burns the ticket on use, so a
 * URL that leaks into a log is worthless within a minute.
 */

import type {
  DurableObjectState,
  WebSocket as WorkersWebSocket,
} from "@cloudflare/workers-types";
import { isRealtimeEntity } from "@kataria-syntex/shared";
import { sha256Hex } from "../lib/token";

const TICKET_TTL_MS = 60_000;
const MAX_CONNECTIONS = 64;
const TICKET_HASH_RE = /^[0-9a-f]{64}$/;
const CLIENT_ID_RE = /^[A-Za-z0-9._-]{1,64}$/;

export class RealtimeRoom {
  private state: DurableObjectState;
  /** sha256(ticket) → expiry + the suppressing client id (null = none). */
  private tickets = new Map<
    string,
    { expiresAt: number; clientId: string | null }
  >();

  constructor(state: DurableObjectState) {
    this.state = state;
    // Keepalives never wake the room: "ping" → "pong" is answered at the
    // runtime layer for every accepted socket.
    this.state.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong"),
    );
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/ticket") {
      return this.issueTicket(request);
    }
    if (request.method === "POST" && url.pathname === "/publish") {
      return this.publish(request);
    }
    if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
      return this.connect(url);
    }
    return new Response(null, { status: 404 });
  }

  /** Mints storage for a one-shot ticket (the caller returns the raw ticket
   * to the client; only the hash lands here). */
  private async issueTicket(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(null, { status: 400 });
    }
    if (body === null || typeof body !== "object") {
      return new Response(null, { status: 400 });
    }
    const { hash, clientId } = body as { hash?: unknown; clientId?: unknown };
    if (typeof hash !== "string" || !TICKET_HASH_RE.test(hash)) {
      return new Response(null, { status: 400 });
    }
    // null = header-less client: accepted, but never matched for echo
    // suppression (a shared sentinel would collide unrelated clients).
    if (
      clientId !== null &&
      (typeof clientId !== "string" || !CLIENT_ID_RE.test(clientId))
    ) {
      return new Response(null, { status: 400 });
    }
    this.sweepTickets();
    this.tickets.set(hash, {
      expiresAt: Date.now() + TICKET_TTL_MS,
      clientId: clientId as string | null,
    });
    return new Response(null, { status: 204 });
  }

  private sweepTickets(): void {
    const now = Date.now();
    for (const [hash, entry] of this.tickets) {
      if (entry.expiresAt <= now) this.tickets.delete(hash);
    }
  }

  /** Validates the one-shot ticket, then upgrades the socket. */
  private async connect(url: URL): Promise<Response> {
    const ticket = url.searchParams.get("ticket") ?? "";
    if (!ticket || ticket.length > 128) {
      return new Response("invalid_ticket", { status: 401 });
    }
    const hash = await sha256Hex(ticket);
    const entry = this.tickets.get(hash);
    this.tickets.delete(hash); // single-use, even on failure
    if (!entry || entry.expiresAt <= Date.now()) {
      return new Response("invalid_ticket", { status: 401 });
    }
    if (this.state.getWebSockets().length >= MAX_CONNECTIONS) {
      return new Response("room_full", { status: 503 });
    }

    const pair = new WebSocketPair();
    // Hibernation: the server end (pair[1]) is accepted into the DO and must
    // NOT be returned — the client end (pair[0]) goes back to the peer. The
    // client id rides as a hibernation tag (persisted by the runtime) so
    // publish can skip the writer's own sockets; header-less clients get no
    // tag and are never suppressed.
    const server = pair[1] as unknown as WorkersWebSocket;
    this.state.acceptWebSocket(
      server,
      entry.clientId ? [`cid:${entry.clientId}`] : [],
    );
    // The Response's webSocket field is a Workers runtime extension; the
    // double cast bridges DOM and workers-types Response inits.
    return new Response(null, {
      status: 101,
      webSocket: pair[0],
    } as unknown as ResponseInit);
  }

  /** Fan-out: forward refresh hints to every live socket. */
  private async publish(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(null, { status: 400 });
    }
    if (body === null || typeof body !== "object") {
      return new Response(null, { status: 400 });
    }
    const { entities, from } = body as { entities?: unknown; from?: unknown };
    if (
      !Array.isArray(entities) ||
      entities.length === 0 ||
      !entities.every(isRealtimeEntity)
    ) {
      return new Response(null, { status: 400 });
    }
    const fromId = typeof from === "string" ? from : null;
    const messages = entities.map((entity) =>
      JSON.stringify({ e: entity, by: fromId }),
    );
    // The writer's own sockets are identified by their hibernation tag —
    // those clients refreshed through their own write paths already.
    const skip =
      fromId !== null
        ? new Set(this.state.getWebSockets(`cid:${fromId}`))
        : null;
    for (const ws of this.state.getWebSockets()) {
      if (skip?.has(ws)) continue;
      for (const message of messages) {
        try {
          ws.send(message);
        } catch {
          // Dead socket — the client's own close/reconnect handles it.
        }
      }
    }
    return new Response(null, { status: 204 });
  }

  // Hibernation lifecycle — nothing to persist, the runtime cleans up.
  async webSocketMessage(
    _ws: WorkersWebSocket,
    _message: string | ArrayBuffer,
  ): Promise<void> {}
  async webSocketClose(_ws: WorkersWebSocket): Promise<void> {}
  async webSocketError(_ws: WorkersWebSocket): Promise<void> {}
}
