import type {
  ExportedHandler,
  ExportedHandlerFetchHandler,
} from "@cloudflare/workers-types";
import type { Env } from "./env";
import { app } from "./index";

// Worker entry: every /api/* request hits the Hono app — unknown API paths
// answer JSON not_found from the app itself, never the SPA. Everything else
// falls through to the static assets layer, whose not_found_handling serves
// the SPA's index.html (deep links, PWA routes).
//
// The double-casts bridge two Request/Response typings that coexist in this
// tsconfig: lib.dom (shared with the client bundle) and workers-types (this
// runtime). At runtime the Workers globals are the only ones that exist.
type FetchHandler = NonNullable<ExportedHandler<Env>["fetch"]>;
type FetchResult = ReturnType<FetchHandler>;

export default {
  fetch: (request, env, ctx): FetchResult => {
    if (new URL(request.url).pathname.startsWith("/api")) {
      return app.fetch(request as unknown as Request, env, {
        waitUntil: (promise) => ctx.waitUntil(promise),
        passThroughOnException: () => ctx.passThroughOnException(),
        props: {},
      }) as unknown as FetchResult;
    }
    return env.ASSETS.fetch(
      request as unknown as Parameters<Fetcher["fetch"]>[0],
    ) as unknown as FetchResult;
  },
} satisfies ExportedHandler<Env>;
