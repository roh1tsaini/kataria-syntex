/**
 * Custom service worker — owns the whole PWA update flow. Compiled by
 * vite-plugin-pwa (strategies: "injectManifest"), which injects the precache
 * manifest (url + revision per dist file) as `self.__WB_MANIFEST`. No workbox
 * at runtime — this file is the runtime:
 *
 * - install caches every manifest entry SEQUENTIALLY, skipping files already
 *   cached by the previous version, and broadcasts byte progress to the app
 *   (ks:sw-progress messages) so Settings can show
 *   "34% · 12.8 of 38.1 MB · ~20s left" while a deploy downloads. A routine
 *   deploy renders no surface at all — the readout is the only place this
 *   progress appears.
 * - fetch serves precached assets cache-first, network-first for navigations
 *   (fresh shell on every load, precached index.html as the offline
 *   fallback) — never for /api/* or /releases/* — and caches the Inter TTFs
 *   on first use (they only matter when rendering a challan PDF).
 * - self-applying: install finishes the precache, then the worker calls
 *   skipWaiting() and claims its clients on activate. A deploy therefore
 *   takes effect on its own — no prompt, no banner, no forced reload. The
 *   running tab keeps its code until its next navigation (network-first, so
 *   it serves the fresh shell); the worker only aligns the offline precache
 *   with the build that is already running.
 */

type PrecacheEntry = { url: string; revision: string | null };

declare global {
  interface ServiceWorkerGlobalScope {
    __WB_MANIFEST: readonly PrecacheEntry[];
  }
}

declare const self: ServiceWorkerGlobalScope;
export {};

const PRECACHE = "ks-precache-v1";
const RUNTIME = "ks-runtime-v1";
const RUNTIME_MAX_ENTRIES = 8;
const REVISION_PARAM = "__KS_REVISION__";
// API calls are never cached — offline queuing is handled in-app (lib/offline)
// against explicit user intent, not a stale SW cache. /releases/* must bypass
// the SPA fallback too: the fallback would answer installer/APK downloads
// with cached index.html (users get an .htm file instead of the app).
const NETWORK_ONLY = [/^\/api\//, /^\/releases\//];

const manifest = self.__WB_MANIFEST;
const absolute = (url: string): string =>
  new URL(url, self.location.origin).toString();
const cacheKeyFor = (entry: PrecacheEntry): string => {
  const url = new URL(absolute(entry.url));
  if (entry.revision) url.searchParams.set(REVISION_PARAM, entry.revision);
  return url.toString();
};
const keyByUrl = new Map(
  manifest.map((e) => [absolute(e.url), cacheKeyFor(e)]),
);
const indexEntry = manifest.find((e) => e.url === "index.html");
const INDEX_KEY = indexEntry ? cacheKeyFor(indexEntry) : "/index.html";

async function broadcast(message: unknown): Promise<void> {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  for (const client of clients) client.postMessage(message);
}

self.addEventListener("install", (event) => {
  // skipWaiting only after the precache is complete: activating mid-install
  // would leave the offline fallback pointing at a half-filled cache, and a
  // failed install must leave the old worker in charge.
  event.waitUntil(installPrecache().then(() => self.skipWaiting()));
});

async function installPrecache(): Promise<void> {
  try {
    const cache = await caches.open(PRECACHE);
    // Sizes up front (parallel HEADs are cheap) so the app can show real
    // percent + ETA while the files stream down. A failed or content-length-
    // less HEAD just drops that file out of the total.
    const sizes = await Promise.all(
      manifest.map(async (entry) => {
        try {
          const head = await fetch(absolute(entry.url), {
            method: "HEAD",
            cache: "no-store",
          });
          return Number(head.headers.get("content-length")) || 0;
        } catch {
          return 0;
        }
      }),
    );
    const totalBytes = sizes.reduce((sum, size) => sum + size, 0);

    let done = 0;
    let bytes = 0;
    for (let i = 0; i < manifest.length; i++) {
      const entry = manifest[i];
      const key = cacheKeyFor(entry);
      const cached = await cache.match(key);
      if (!cached) {
        const res = await fetch(absolute(entry.url), { cache: "reload" });
        if (!res.ok || !res.body)
          throw new Error(`precache_failed: ${entry.url}`);
        await cache.put(key, res);
      }
      bytes += cached
        ? Number(cached.headers.get("content-length")) || sizes[i]
        : sizes[i];
      done++;
      await broadcast({
        type: "ks:sw-progress",
        stage: "install",
        done,
        totalFiles: manifest.length,
        bytes,
        totalBytes,
      });
    }
    await broadcast({ type: "ks:sw-progress", stage: "done" });
  } catch (err) {
    await broadcast({ type: "ks:sw-progress", stage: "error" });
    throw err;
  }
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop entries the current manifest no longer carries (old revisions
      // hash to new keys) and any cache from an older naming scheme.
      const cache = await caches.open(PRECACHE);
      const valid = new Set(manifest.map(cacheKeyFor));
      for (const request of await cache.keys()) {
        if (!valid.has(request.url)) await cache.delete(request);
      }
      for (const name of await caches.keys()) {
        if (name !== PRECACHE && name !== RUNTIME) await caches.delete(name);
      }
      // Claim the open tabs: their next navigation is served by this worker,
      // with the fresh precache behind it. Client code is never swapped
      // underfoot — claiming changes who serves requests, not what is running.
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NETWORK_ONLY.some((re) => re.test(url.pathname))) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        // Network-first: every full page load revalidates the shell against
        // the edge (index.html is no-cache), so a deployed build reaches an
        // open tab on its next navigation without waiting for the new worker
        // to activate. The precached copy is the offline fallback only — a
        // cache-first navigation would pin the old __APP_VERSION__ until the
        // user clicks through the banner, which is the every-page nag loop.
        const cache = await caches.open(PRECACHE);
        try {
          const fresh = await fetch(request);
          if (fresh.ok) return fresh;
          const cached = await cache.match(INDEX_KEY);
          return cached ?? fresh;
        } catch {
          const cached = await cache.match(INDEX_KEY);
          if (cached) return cached;
          throw new Error("offline without a cached shell");
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(PRECACHE);
      const direct = await cache.match(url.toString());
      if (direct) return direct;
      const keyed = keyByUrl.get(url.toString());
      if (keyed) {
        const hit = await cache.match(keyed);
        if (hit) return hit;
      }
      // Inter TTFs ride outside the precache (deliberate — they only matter
      // when rendering a challan PDF) and cache on first use instead.
      if (/\.ttf$/.test(url.pathname)) {
        const runtime = await caches.open(RUNTIME);
        const hit = await runtime.match(url.toString());
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) {
          await runtime.put(url.toString(), res.clone());
          void pruneRuntime(runtime);
        }
        return res;
      }
      return fetch(request);
    })(),
  );
});

async function pruneRuntime(cache: Cache): Promise<void> {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - RUNTIME_MAX_ENTRIES; i++) {
    await cache.delete(keys[i]);
  }
}
