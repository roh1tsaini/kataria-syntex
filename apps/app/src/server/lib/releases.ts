/**
 * Release-object serving for /releases/* — installers, APK and update
 * manifests read straight out of the `ks-releases` R2 bucket. The URL path
 * after /releases/ IS the object key (CI owns the layout: app/desktop/…,
 * app/android/…). This route is public: the artifacts are not secrets and
 * the /download page plus native updaters fetch them without a session.
 *
 * Caching splits by key: versioned artifacts are immutable and cached for a
 * year, while the latest-* manifests keep a 60s TTL so updaters see a new
 * release within a minute of CI pushing it.
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
    "Content-Length": String(size),
    "Cache-Control": cacheControl(key),
    ETag: etag,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD",
  });
  return headers;
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

  const notModified = request.headers.get("if-none-match");

  if (request.method === "HEAD") {
    const obj = await env.RELEASES.head(key);
    if (!obj) return Response.json({ error: "not_found" }, { status: 404 });
    return new Response(null, {
      status: 200,
      headers: baseHeaders(key, obj.size, obj.httpEtag),
    });
  }

  const obj = await env.RELEASES.get(key, {
    onlyIf: notModified ? { etagMatches: notModified } : undefined,
  });
  if (!obj) return Response.json({ error: "not_found" }, { status: 404 });

  const headers = baseHeaders(key, obj.size, obj.httpEtag);
  // R2 answers a matching If-None-Match with metadata only (no body stream).
  if (!("body" in obj) || obj.body === null) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(obj.body, { status: 200, headers });
}
