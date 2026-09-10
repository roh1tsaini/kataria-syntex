import { Hono } from "hono";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { cors } from "hono/cors";
import type { Env } from "./env";
import { healthRoute } from "./routes/health";
import { authRoute } from "./routes/auth";
import { membersRoute } from "./routes/members";
import { companyRoute } from "./routes/company";
import { mastersRoute } from "./routes/masters";
import { recipesRoute } from "./routes/recipes";
import { challansRoute } from "./routes/challans";
import { returnsRoute } from "./routes/returns";
import { rawMaterialRoute } from "./routes/raw-material";
import { packingRoute } from "./routes/packing";
import { stockRoute } from "./routes/stock";
import { reportsRoute } from "./routes/reports";
import { realtimeRoute } from "./routes/realtime";
import { apiError } from "./lib/api-error";
import { versionGate } from "./lib/version-gate";
import { APP_VERSION, MIN_APP_VERSION } from "./lib/app-version";

// The worker entry (src/server/worker.ts) routes every /api/* request here.
// Static SPA assets are served by the assets layer — this app only knows
// /api/*.
export const app = new Hono<{ Bindings: Env }>();

// Log requests without query strings — QR codes and other tokens ride in
// URLs, and the default hono logger writes the full path to stdout.
app.use(
  "*",
  logger((message) => console.log(message.replace(/\?[^\s]*/g, ""))),
);
app.use("*", secureHeaders());
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      if (!origin) return null;
      if (origin === "null") return null;
      const allowed = (c.env as Env).CORS_ORIGIN;
      if (!allowed) return null;
      return allowed
        .split(",")
        .map((s) => s.trim())
        .includes(origin)
        ? origin
        : null;
    },
    credentials: true,
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Client-Id",
      "X-Platform",
      "X-Device-Label",
      "X-Device-Fingerprint",
    ],
    maxAge: 86_400,
  }),
);

// Every API response is fresh-by-contract: business data changes on every
// write, responses are session-scoped, and 426 gate bodies must never be
// cached by an intermediary. The assets layer (public/_headers) handles the
// static side; this pins the dynamic side.
app.use("/api/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
});

app.route("/api", healthRoute);
// Force-update gate sits above every domain route — see lib/version-gate.ts.
app.use("/api/*", versionGate);
app.route("/api/auth", authRoute);
app.route("/api/members", membersRoute);
app.route("/api/company", companyRoute);
app.route("/api/masters", mastersRoute);
app.route("/api/recipes", recipesRoute);
app.route("/api/challans", challansRoute);
app.route("/api/returns", returnsRoute);
app.route("/api/raw-material", rawMaterialRoute);
app.route("/api/packing", packingRoute);
app.route("/api/stock", stockRoute);
app.route("/api/reports", reportsRoute);
// Realtime sits below the version gate like every domain route (the ticket
// call is a normal api() request and must obey the same update contract).
app.route("/api/realtime", realtimeRoute);

app.notFound((c) => {
  return apiError(c, "not_found", 404);
});

app.onError((err, c) => {
  console.error("unhandled_error", err);
  const dev = c.env.APP_ENV === "development";
  return c.json(
    {
      error: "internal_server_error",
      ...(dev
        ? { detail: err instanceof Error ? err.message : String(err) }
        : {}),
    },
    500,
  );
});
