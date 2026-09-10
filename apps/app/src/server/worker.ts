import type {
  ExportedHandler,
  ExportedHandlerFetchHandler,
} from "@cloudflare/workers-types";
import type { Env } from "./env";
import { app } from "./index";
import { serveReleases } from "./lib/releases";
import { RealtimeRoom } from "./realtime/room";

// The realtime WebSocket upgrade bypasses Hono entirely — a 101 response
// must not run through the middleware stack built for JSON responses, and
// the upgrade path is already version-gate-exempt by design (the ticket is
// the credential; see lib/version-gate.ts). Only genuine upgrades are
// forwarded to the workspace's RealtimeRoom; anything else falls through
// to Hono's JSON 404 below.
// The structural request type bridges the DOM and workers-types Request
// declarations that coexist in this tsconfig (see the note below).
type AnyRequest = {
  url: string;
  headers: { get(name: string): string | null };
};

function isRealtimeUpgrade(request: AnyRequest): boolean {
  return (
    new URL(request.url).pathname === "/api/realtime/ws" &&
    request.headers.get("upgrade")?.toLowerCase() === "websocket"
  );
}

// Worker entry: every /api/* request hits the Hono app — unknown API paths
// answer JSON not_found from the app itself, never the SPA. /releases/*
// streams objects out of the R2 release bucket (public, cache-split by key).
// Everything else falls through to the static assets layer, whose
// not_found_handling serves the SPA's index.html (deep links, PWA routes).
//
// The double-casts bridge two Request/Response typings that coexist in this
// tsconfig: lib.dom (shared with the client bundle) and workers-types (this
// runtime). At runtime the Workers globals are the only ones that exist.
type FetchHandler = NonNullable<ExportedHandler<Env>["fetch"]>;
type FetchResult = ReturnType<FetchHandler>;

export default {
  fetch: (request, env, ctx): FetchResult => {
    const { pathname } = new URL(request.url);
    if (isRealtimeUpgrade(request)) {
      const workspace = new URL(request.url).searchParams.get("workspace");
      if (
        !workspace ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          workspace,
        )
      ) {
        return new Response("not_found", {
          status: 404,
        }) as unknown as FetchResult;
      }
      const stub = env.REALTIME.get(env.REALTIME.idFromName(workspace));
      return (stub.fetch as unknown as (req: unknown) => Promise<unknown>)(
        request,
      ) as unknown as FetchResult;
    }
    if (pathname.startsWith("/api")) {
      return app.fetch(request as unknown as Request, env, {
        waitUntil: (promise) => ctx.waitUntil(promise),
        passThroughOnException: () => ctx.passThroughOnException(),
        props: {},
      }) as unknown as FetchResult;
    }
    if (pathname.startsWith("/releases/")) {
      return serveReleases(
        request as unknown as Request,
        env,
      ) as unknown as FetchResult;
    }
    return env.ASSETS.fetch(
      request as unknown as Parameters<Fetcher["fetch"]>[0],
    ) as unknown as FetchResult;
  },
} satisfies ExportedHandler<Env>;

export { RealtimeRoom };
