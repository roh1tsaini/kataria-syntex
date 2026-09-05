import { Hono } from "hono";
import type { Env } from "../env";

export const healthRoute = new Hono<{ Bindings: Env }>();

healthRoute.get("/health", (c) => {
  return c.json({
    ok: true,
    service: "ks-biz-app",
    time: new Date().toISOString(),
  });
});
