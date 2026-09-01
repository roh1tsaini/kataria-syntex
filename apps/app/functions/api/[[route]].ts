import type { EventContext, PagesFunction } from "@cloudflare/workers-types";
import type { Env } from "../../src/server/env";
import { app } from "../../src/server";

// Catch-all: every /api/* request hits the Hono app; unknown paths answer
// JSON not_found from the app itself, never the SPA.
//
// The double-casts bridge two Request/Response typings that coexist in this
// tsconfig: lib.dom (shared with the client bundle) and workers-types (this
// runtime). At runtime the Workers globals are the only ones that exist.
export const onRequest: PagesFunction<Env> = (
  ctx: EventContext<Env, string, Record<string, unknown>>,
) =>
  app.fetch(ctx.request as unknown as Request, ctx.env, {
    // Hono's ExecutionContext adds a Wrangler-4 `props` field Pages'
    // EventContext doesn't have — delegate the real methods through.
    waitUntil: (promise) => ctx.waitUntil(promise),
    passThroughOnException: () => ctx.passThroughOnException(),
    props: {},
  }) as unknown as ReturnType<PagesFunction<Env>>;
