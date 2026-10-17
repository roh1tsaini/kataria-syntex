import { Hono } from "hono";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { cors } from "hono/cors";
import type { Env } from "./env";
import { healthRoute } from "./routes/health";
import { authRoute } from "./routes/auth";
import { apiError } from "./lib/api-error";
import { versionGate } from "./lib/version-gate";
import { telegramRoute } from "./routes/telegram";

// The worker entry (src/server/worker.ts) routes every /api/* request here.
// Static SPA assets are served by the assets layer — this app only knows
// /api/*.
export const app = new Hono<{ Bindings: Env }>();

// Log requests without query strings — opaque ids and other client values
// ride in URLs, and the default hono logger writes the full path to stdout.
app.use(
  "*",
  logger((message) => console.log(message.replace(/\?[^\s]*/g, ""))),
);
app.use("*", secureHeaders());
/**
 * Origins of the app's own native shells. The Capacitor Android WebView
 * serves the bundle from a fixed synthetic origin — apps/android's
 * capacitor.config.ts sets server.androidScheme "https" and Capacitor's
 * hostname default is "localhost", so the origin is https://localhost. That
 * is a first-party app shell, not a third-party site: it is fixed by our own
 * native config, so it is allowed here unconditionally (depending on a
 * deploy-time allowlist for a structural origin silently bricks the whole app
 * as "offline").
 *
 * Every request from the WebView is cross-origin to this Worker and carries
 * custom headers (X-App-Version and friends), so it needs a passing
 * preflight before it even leaves the device. CORS is not an auth boundary —
 * each route still requires a valid session — it only stops other sites'
 * pages from reading our responses, and an origin no other app can claim
 * is not one.
 */
const SHELL_ORIGINS = ["https://localhost"];

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return null;
      // An opaque "null" origin (sandboxed frame, file://) is never
      // trusted — any page can present it, so it stays out of every
      // allowlist.
      if (origin === "null") return null;
      return SHELL_ORIGINS.includes(origin) ? origin : null;
    },
    credentials: true,
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-App-Version",
      "X-Platform",
      "X-Device-Label",
      "X-Device-Fingerprint",
    ],
    maxAge: 86_400,
  }),
);

// Every API response is fresh-by-contract: responses are session-scoped, and
// 426 gate bodies must never be cached by an intermediary. The assets layer
// (public/_headers) handles the static side; this pins the dynamic side.
app.use("/api/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
});

app.route("/api", healthRoute);
app.route("/api/telegram", telegramRoute);
// Force-update gate — see lib/version-gate.ts. /api/health and the Telegram
// webhook register above it; /api/auth registers below but is exempt by path.
app.use("/api/*", versionGate);
app.route("/api/auth", authRoute);

app.notFound((c) => {
  return apiError(c, "not_found", 404);
});

app.onError((err, c) => {
  console.error("unhandled_error", err);
  return c.json({ error: "internal_server_error" }, 500);
});
