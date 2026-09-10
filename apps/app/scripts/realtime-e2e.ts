/**
 * E2E realtime smoke: seed a local session → authed ticket → WebSocket join
 * → live publish on a write → echo suppression → cleanup.
 *
 * Prereq: the Hono dev server must be up (`bun run dev:server` in apps/app).
 * Run from apps/app: bun scripts/realtime-e2e.ts
 * Test-only; touches only the LOCAL D1 (wrangler --local), never production.
 */
export {};

import { spawnSync } from "node:child_process";

const API = "http://127.0.0.1:3000";
const USER_ID = "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const WS_ID = "22222222-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const DEVICE_ID = "33333333-cccc-4ccc-8ccc-cccccccccc3";
const SESSION_ID = "44444444-dddd-4ddd-8ddd-dddddddddd4";
const LISTENER_ID = "e2e-listener";
const WRITER_ID = "e2e-writer";

// ── Seed: user + workspace + device + session against the local D1 ─────────
const rawToken = crypto.randomUUID() + crypto.randomUUID();
const tokenHash = Array.from(
  new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawToken)),
  ),
)
  .map((b) => b.toString(16).padStart(2, "0"))
  .join("");
const now = new Date().toISOString();
const seed = (sql: string) =>
  spawnSync(
    "bunx",
    ["wrangler", "d1", "execute", "ks-biz-app-db", "--local", "--command", sql],
    { cwd: import.meta.dir + "/..", encoding: "utf8" },
  );
seed(
  `INSERT OR IGNORE INTO users (id, email, name, created_at, updated_at) VALUES ('${USER_ID}','rt-e2e@test.local','RT E2E','${now}','${now}');` +
    `INSERT OR IGNORE INTO workspaces (id, name, created_by, created_at) VALUES ('${WS_ID}','RT E2E WS','${USER_ID}','${now}');` +
    `INSERT OR IGNORE INTO memberships (user_id, workspace_id, is_primary_admin, joined_at) VALUES ('${USER_ID}','${WS_ID}',1,'${now}');` +
    `INSERT OR IGNORE INTO devices (id, user_id, label, platform, created_at, last_seen_at) VALUES ('${DEVICE_ID}','${USER_ID}','E2E Test','web','${now}','${now}');` +
    `INSERT OR REPLACE INTO sessions (id, device_id, token_hash, created_at, expires_at) VALUES ('${SESSION_ID}','${DEVICE_ID}','${tokenHash}','${now}',NULL);`,
);
const cleanup = () =>
  seed(
    `DELETE FROM sessions WHERE id='${SESSION_ID}'; DELETE FROM devices WHERE id='${DEVICE_ID}';` +
      `DELETE FROM memberships WHERE user_id='${USER_ID}'; DELETE FROM customers WHERE name LIKE 'E2E %';` +
      `DELETE FROM workspaces WHERE id='${WS_ID}'; DELETE FROM users WHERE id='${USER_ID}';`,
  );
process.on("exit", () => cleanup());

// ── 1. Mint a one-shot ticket (listener identity → socket attachment) ──────
const baseHeaders = {
  Authorization: `Bearer ${rawToken}`,
  "X-App-Version": "0.8.0",
  Cookie: `kc_session=${rawToken}`,
};
const res = await fetch(`${API}/api/realtime/ticket`, {
  method: "POST",
  headers: { ...baseHeaders, "X-Client-Id": LISTENER_ID },
});
if (res.status !== 200) throw new Error(`ticket failed: ${res.status}`);
const { ticket } = (await res.json()) as { ticket: string };
console.log("ticket OK");

// ── 2. Connect — the ticket is the only credential on the WS URL ───────────
const ws = new WebSocket(
  `${API.replace("http", "ws")}/api/realtime/ws?workspace=${WS_ID}&ticket=${ticket}`,
);
// Collect messages from birth: publishes ride waitUntil and can land before
// the write's fetch response resolves.
const messages: string[] = [];
ws.onmessage = (ev) => {
  messages.push(String(ev.data));
};
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error("ws open timeout")), 10_000);
  ws.onopen = () => {
    clearTimeout(t);
    resolve(null);
  };
  ws.onerror = () => reject(new Error("ws error"));
});
console.log("socket OK");

function nextMessage(contains: string, timeoutMs = 10_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      clearInterval(poll);
      reject(
        new Error(`no message containing "${contains}" within ${timeoutMs}ms`),
      );
    }, timeoutMs);
    const poll = setInterval(() => {
      const hit = messages.find((m) => m.includes(contains));
      if (hit) {
        clearTimeout(timer);
        clearInterval(poll);
        resolve(hit);
      }
    }, 50);
  });
}

// ── 3. Keepalive: the runtime answers "pong" to "ping" without waking the DO
ws.send("ping");
console.log("keepalive OK:", await nextMessage("pong", 5_000));

// ── 4. A different device writes → the listener receives the event ─────────
const create = await fetch(`${API}/api/masters/customers`, {
  method: "POST",
  headers: {
    ...baseHeaders,
    "X-Client-Id": WRITER_ID,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ name: `E2E other ${Date.now()}` }),
});
console.log("other write status:", create.status);

const message = await nextMessage("masters");
const parsed = JSON.parse(message) as { e?: string; by?: string };
if (parsed.e !== "masters" || parsed.by !== WRITER_ID) {
  throw new Error(`unexpected event: ${message}`);
}
console.log("event OK:", message);

// ── 5. Echo suppression: the listener's own write must NOT come back ───────
const own = await fetch(`${API}/api/masters/customers`, {
  method: "POST",
  headers: {
    ...baseHeaders,
    "X-Client-Id": LISTENER_ID,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ name: `E2E own ${Date.now()}` }),
});
console.log("own write status:", own.status);
await Bun.sleep(3_000);
const before = 1; // the masters event from step 4
const after = messages.filter((m) => m.includes("masters")).length;
if (after !== before) throw new Error(`echo not suppressed (${after} events)`);
console.log("echo check: suppressed OK");

ws.close();
console.log("E2E PASS");
process.exit(0);
