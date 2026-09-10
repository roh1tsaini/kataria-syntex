/**
 * Realtime engine — a WebSocket change bus over the server's RealtimeRoom.
 *
 * The server stamps every write's broadcast with the writer's X-Client-Id;
 * a client skips events carrying its own id (its own writes already
 * refresh through the normal store paths). Every event is a refresh hint
 * — {"e":"<entity>"} — never a payload, so clients refetch through the
 * regular api() paths and the bus carries no business data.
 *
 * A drop never degrades the app: the poll-and-sync paths (30s heartbeat,
 * refetch-on-mount) are unchanged and remain the source of truth. The
 * socket reconnects on an exponential-backoff schedule, is reset on network
 * return, and reconnects immediately on app foreground.
 */

import { useEffect, useRef } from "react";
import { core } from "./adapter";
import { api, clientId } from "./api";
import { useAuth } from "./store/auth";
import { isRealtimeEntity, type RealtimeEntity } from "@kataria-syntex/shared";

export type ChangeHandler = (entity: RealtimeEntity) => void;

type Listener = {
  entity: RealtimeEntity | "all";
  fn: ChangeHandler;
};

const listeners = new Set<Listener>();

/** Server event shape: {"e":"<entity>","by":"<clientId>"} */
type RealtimeEvent = { e?: unknown; by?: unknown };

const MAX_BACKOFF_MS = 60_000;

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let backoffMs = 1_000;
let currentWorkspaceId: string | null = null;
let started = false;

function realtimeSupported(): boolean {
  const a = core();
  return typeof a.realtimeOrigin === "function" && !!a.realtimeOrigin();
}

/** ws(s):// origin + /api/realtime/ws — wss for https origins, ws otherwise
 * (must match the upgrade path the worker intercepts: worker.ts
 * isRealtimeUpgrade). */
function realtimeUrl(workspaceId: string, ticket: string): string {
  const raw = core().realtimeOrigin?.() ?? "";
  const base = raw.startsWith("https://")
    ? `wss://${raw.slice("https://".length)}`
    : raw.startsWith("http://")
      ? `ws://${raw.slice("http://".length)}`
      : raw;
  const url = new URL(`${base}/api/realtime/ws`);
  url.searchParams.set("workspace", workspaceId);
  url.searchParams.set("ticket", ticket);
  return url.toString();
}

/** One-shot connect ticket: POST /realtime/ticket answers {ticket} after the
 * server has verified the session and workspace membership. */
async function fetchTicket(): Promise<string | null> {
  try {
    const res = await api<{ ticket?: unknown }>("/realtime/ticket", {
      method: "POST",
    });
    return typeof res.ticket === "string" && res.ticket ? res.ticket : null;
  } catch {
    return null;
  }
}

function clearReconnectTimer(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function closeSocket(): void {
  clearReconnectTimer();
  backoffMs = 1_000;
  if (socket) {
    // Null first so onclose's reconnect path sees a deliberate close.
    const s = socket;
    socket = null;
    try {
      s.close();
    } catch {
      // already closed
    }
  }
}

function scheduleReconnect(): void {
  if (!started || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connect();
  }, backoffMs);
  backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
}

// Guards the async gap between connect() entry and socket assignment: two
// overlapping triggers (network return + backoff timer) would otherwise both
// pass the `socket` check during the ticket fetch and open duplicate sockets.
let connecting = false;

async function connect(): Promise<void> {
  if (!started || socket || connecting) return;
  const workspaceId = useAuth.getState().workspace?.id;
  if (!workspaceId) return;
  connecting = true;

  try {
    const ticket = await fetchTicket();
    if (!started) return;
    if (!ticket) {
      // Server unreachable or session gone — the sync engine surfaces state;
      // here we just back off. The next network/activity event retries sooner.
      scheduleReconnect();
      return;
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(realtimeUrl(workspaceId, ticket));
    } catch {
      scheduleReconnect();
      return;
    }
    socket = ws;

    ws.onopen = () => {
      if (socket !== ws) return;
      backoffMs = 1_000;
    };

    ws.onmessage = (ev: MessageEvent) => {
      if (socket !== ws) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (parsed === null || typeof parsed !== "object") return;
      const { e, by } = parsed as RealtimeEvent;
      if (!isRealtimeEntity(e)) return;
      if (typeof by === "string" && by === clientId()) return; // own write
      for (const l of [...listeners]) {
        if (l.entity === "all" || l.entity === e) {
          try {
            l.fn(e);
          } catch {
            // one broken listener must not kill the bus
          }
        }
      }
    };

    ws.onclose = () => {
      if (socket !== ws) return;
      socket = null;
      scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose fires after onerror for the same failure — reconnect there.
      try {
        ws.close();
      } catch {
        // already closing
      }
    };
  } finally {
    connecting = false;
  }
}

/**
 * Subscribes to server change events. Returns an unsubscribe function.
 * Listeners are process-level (not per-component); components should
 * prefer the useRealtimeEvent hook.
 */
export function subscribeChanges(
  entity: RealtimeEntity | "all",
  fn: ChangeHandler,
): () => void {
  const listener = { entity, fn };
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const REFRESH_DEBOUNCE_MS = 400;

/**
 * Live-refresh hook for page-level data. Calls `onEvent` (debounced — a
 * burst of writes coalesces into one refresh) whenever the server reports
 * a change in one of `entities` while the component is mounted. Pages pass
 * their existing load callback; nothing else changes.
 */
export function useRealtimeEvent(
  entities: readonly RealtimeEntity[],
  onEvent: () => void,
): void {
  const handler = useRef(onEvent);
  handler.current = onEvent;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Pages pass inline entity arrays — key on content, not identity.
  const key = entities.join("|");

  useEffect(() => {
    const list = key.split("|") as RealtimeEntity[];
    const unsub = subscribeChanges("all", (entity) => {
      if (!list.includes(entity)) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        handler.current();
      }, REFRESH_DEBOUNCE_MS);
    });
    return () => {
      unsub();
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [key]);
}

/**
 * Wires the realtime connection for the app lifetime — mount once next to
 * useOfflineSync() in each shell's root. Joins the authed workspace's room;
 * reconnects on workspace change, network return, and foreground. A shell
 * whose adapter has no realtimeOrigin() keeps everything poll-only.
 */
export function useRealtime(): void {
  const workspaceId = useAuth((s) => s.workspace?.id ?? null);
  const status = useAuth((s) => s.status);
  // Latest values for event handlers that must not re-run the effect.
  const liveRef = useRef({ workspaceId, status });
  liveRef.current = { workspaceId, status };

  useEffect(() => {
    started = true;
    const a = core();

    const reconnect = () => {
      if (!realtimeSupported()) return;
      const { workspaceId: ws, status: st } = liveRef.current;
      if (st !== "authed" || !ws) return;
      if (ws === currentWorkspaceId && socket) return;
      closeSocket();
      currentWorkspaceId = ws;
      void connect();
    };

    if (status === "authed" && workspaceId) {
      if (workspaceId !== currentWorkspaceId) {
        closeSocket();
        currentWorkspaceId = workspaceId;
        if (realtimeSupported()) void connect();
      }
    } else {
      closeSocket();
      currentWorkspaceId = null;
    }

    const unsubNet = a.onNetworkChange((online) => {
      if (online) reconnect();
      else closeSocket();
    });
    const unsubActivity = a.onActivityChange?.((active) => {
      if (active) reconnect();
    });

    return () => {
      started = false;
      unsubNet();
      unsubActivity?.();
      closeSocket();
      currentWorkspaceId = null;
    };
  }, [workspaceId, status]);
}
