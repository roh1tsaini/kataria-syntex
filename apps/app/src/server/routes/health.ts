import { Hono } from "hono";
import type { Env } from "../env";

export const healthRoute = new Hono<{ Bindings: Env }>();

healthRoute.get("/health", (c) => {
  return c.json({
    ok: true,
    service: "kataria-challan-app",
    milestone: "M1",
    time: new Date().toISOString(),
  });
});
