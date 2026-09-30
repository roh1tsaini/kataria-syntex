import { Hono } from "hono";
import type { Env } from "../env";
import { APP_VERSION, MIN_APP_VERSION } from "../lib/app-version";

export const healthRoute = new Hono<{ Bindings: Env }>();

healthRoute.get("/health", (c) => {
  return c.json({
    ok: true,
    service: "ks-biz-app",
    time: new Date().toISOString(),
    version: APP_VERSION,
    minVersion: MIN_APP_VERSION,
  });
});
