import { Hono } from "hono";
import type { Env } from "../env";

export const healthRoute = new Hono<{ Bindings: Env }>();

healthRoute.get("/health", (c) => {
  return c.json({
    ok: true,
    service: "kataria-challan-app",
    time: new Date().toISOString(),
  });
});
