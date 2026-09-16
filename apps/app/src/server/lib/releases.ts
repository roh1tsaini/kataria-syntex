/**
 * Release-object serving for /releases/* — installers, APK and update
 * manifests read straight out of the `ks-releases` R2 bucket. The URL path
 * after /releases/ IS the object key (CI owns the layout: app/desktop/…,
 * app/android/…). This route is public: the artifacts are not secrets and
 * the /download page plus native updaters fetch them without a session.
 *
 * Ranged reads are the whole point of this route. electron-updater downloads
 * in byte slices to build its blockmap diff, and R2 serves a slice through
 * `get(key, { range: { offset, length } })`. A ranged request answers 206
 * Partial Content with a Content-Range of the slice it actually returned —
 * and a range that runs past EOF is clamped to the object, never 416.
 *
 * Caching splits by key: versioned artifacts are immutable and cached for a
 * year, while the latest-* manifests keep a 60s TTL so updaters see a new
 * release within a minute of CI pushing it. Manifests are small enough that
 * revalidating them server-side saves nothing worth the extra code path, so
 * they revalidate at the cache layer (max-age + ETag) and the origin always
 * streams the bytes.
 */
import type { Env } from "../env";

const MANIFEST_SUFFIX = /\/latest(\.json|\.yml|-linux\.yml|-mac\.yml)$/i;

const CONTENT_TYPES: Record<string, string> = {
  ".apk": "application/vnd.android.package-archive",
  ".exe": "application/vnd.microsoft.portable-executable",
  ".dmg": "application/x-apple-diskimage",
  ".blockmap": "application/octet-stream",
  ".yml": "application/yaml",
  ".json": "application/json",
};

function contentType(key: string): string {
  const dot = key.lastIndexOf(".");
  const ext = dot === -1 ? "" : key.slice(dot).toLowerCase();
  // The AppImage target has no real extension — treat unknown as raw bytes.
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

function cacheControl(key: string): string {
  return MANIFEST_SUFFIX.test(key)
    ? "public, max-age=60"
    : "public, max-age=31536000, immutable";
}

function baseHeaders(key: string, size: number, etag: string): Headers {
  const headers = new Headers({
    "Content-Type": contentType(key),
    "Cache-Control": cacheControl(key),
    ETag: etag,
    // Differential updaters probe this before slicing. Every response on this
    // route is a byte-range candidate, HEAD included.
    "Accept-Ranges": "bytes",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD",
  });
  // Only present on the responses that actually carry a body.
  headers.set("Content-Length", String(size));
  return headers;
}

/** bytes=0-99 | bytes=0- | bytes=99 → [start, end] or null. */
function parseRange(
  value: string | null,
  size: number,
): [number, number] | null {
  if (!value) return null;
  const [unit, spec] = value.split("=", 2);
  if (!unit || unit.trim().toLowerCase() !== "bytes" || spec === undefined) {
    return null;
  }
  const [rawStart, rawEnd] = spec.trim().split("-", 2);
  // A suffix range (bytes=-500) is the last 500 bytes.
  if (rawStart === "") {
    const length = Number(rawEnd);
    if (!Number.isInteger(length) || length <= 0) return null;
    const start = Math.max(0, size - length);
    return [start, size - 1];
  }
  const start = Number(rawStart);
  if (!Number.isInteger(start) || start < 0 || start >= size) return null;
  if (rawEnd === undefined || rawEnd === "") return [start, size - 1];
  const end = Number(rawEnd);
  if (!Number.isInteger(end) || end < start) return null;
  // The end is inclusive by HTTP contract and clamped to the object size.
  return [start, Math.min(end, size - 1)];
}

export async function serveReleases(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const { pathname } = new URL(request.url);
  let key: string;
  try {
    key = decodeURIComponent(pathname.slice("/releases/".length));
  } catch {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (!key || key.includes("..") || key.startsWith("/")) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const meta = await env.RELEASES.head(key);
  if (!meta) return Response.json({ error: "not_found" }, { status: 404 });

  const asked = request.headers.get("range");
  const range = parseRange(asked, meta.size);

  // An unparsable Range is the client's mistake — say so (416) instead of
  // quietly shipping the whole object, which trains diff downloaders to
  // expect a full body behind a range request.
  if (asked !== null && range === null) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${meta.size}` },
    });
  }

  // HEAD answers the same headers as GET with no body — a client probing a
  // range gets the slice it asked about.
  if (request.method === "HEAD") {
    if (!range) {
      return new Response(null, {
        status: 200,
        headers: baseHeaders(key, meta.size, meta.httpEtag),
      });
    }
    const [start, end] = range;
    const headers = baseHeaders(key, end - start + 1, meta.httpEtag);
    headers.set("Content-Range", `bytes ${start}-${end}/${meta.size}`);
    return new Response(null, { status: 206, headers });
  }

  // No usable Range header: stream the whole object.
  if (!range) {
    const obj = await env.RELEASES.get(key);
    if (!obj || !("body" in obj) || obj.body === null) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    return new Response(obj.body, {
      status: 200,
      headers: baseHeaders(key, obj.size, obj.httpEtag),
    });
  }

  const [start, end] = range;
  const length = end - start + 1;
  const slice = await env.RELEASES.get(key, {
    range: { offset: start, length },
  });
  if (!slice || !("body" in slice) || slice.body === null) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const headers = baseHeaders(key, length, slice.httpEtag);
  headers.set("Content-Range", `bytes ${start}-${end}/${meta.size}`);
  return new Response(slice.body, { status: 206, headers });
}
