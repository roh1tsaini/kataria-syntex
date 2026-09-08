/**
 * CI release publisher — uploads built artifacts to the ks-releases R2
 * bucket via the Cloudflare REST API and rewrites the update manifests.
 *
 * Runs in .github/workflows/app-build.yml after the desktop/Android builds.
 * Latest-only retention: a new release replaces every previous object under
 * app/ (the 10 GB free tier stays empty; caches stay valid because artifact
 * filenames are versioned and only the manifests keep stable URLs).
 *
 * Env:
 *   CF_ACCOUNT_ID, CF_API_TOKEN  — R2 edit token (Workers R2 Storage Edit)
 *   R2_BUCKET                    — bucket name (ks-releases)
 *   VERSION                      — app version being published
 *   DIST_DIR                     — directory with downloaded artifacts
 *
 * Layout written (URL path = object key, served at /releases/<key>):
 *   app/desktop/win/<setup>.exe[.blockmap] + latest.yml
 *   app/desktop/linux/<*.AppImage>         + latest-linux.yml
 *   app/desktop/mac/<*.dmg>                (no yml — unsigned, no updater)
 *   app/android/<*.apk>
 *   app/android/latest.json                — version + minVersion + paths
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";

const ACCOUNT = process.env.CF_ACCOUNT_ID ?? "";
const TOKEN = process.env.CF_API_TOKEN ?? "";
const BUCKET = process.env.R2_BUCKET ?? "ks-releases";
const VERSION = process.env.VERSION ?? "";
const DIST = process.env.DIST_DIR ?? "dist";
const PREFIX = "app";

if (!ACCOUNT || !TOKEN || !VERSION) {
  console.error(
    "CF_ACCOUNT_ID, CF_API_TOKEN and VERSION are required to publish releases.",
  );
  process.exit(1);
}

const API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/objects`;

async function api(
  method: "GET" | "PUT" | "DELETE",
  path: string,
  body?: BodyInit,
  headers?: Record<string, string>,
): Promise<Response> {
  // Query-only paths (list objects) must not get a "/" separator —
  // GET /objects/?x is parsed by the API as an object fetch with an
  // empty key and 404s with code 10007.
  const url = path.startsWith("?") ? `${API}${path}` : `${API}/${path}`;
  return fetch(url, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, ...headers },
    body,
  });
}

async function putObject(
  key: string,
  data: Buffer | string,
  contentType: string,
  cacheControl: string,
): Promise<void> {
  const encoded = encodeURIComponent(key);
  const res = await api("PUT", encoded, data, {
    "Content-Type": contentType,
    "Cache-Control": cacheControl,
  });
  if (!res.ok) {
    console.error(`R2 PUT ${key} failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  console.log(`uploaded ${key}`);
}

/** Lists keys currently under the app/ prefix. */
async function listKeys(): Promise<string[]> {
  const res = await api("GET", `?prefix=${encodeURIComponent(`${PREFIX}/`)}`);
  if (!res.ok) {
    console.error(`R2 list failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const body: unknown = await res.json();
  const keys: string[] = [];
  if (body !== null && typeof body === "object") {
    const list = (body as { result?: unknown }).result;
    if (Array.isArray(list)) {
      for (const item of list) {
        const k = (item as { key?: unknown }).key;
        if (typeof k === "string") keys.push(k);
      }
    }
  }
  return keys;
}

async function deleteObject(key: string): Promise<void> {
  const res = await api("DELETE", encodeURIComponent(key));
  if (!res.ok && res.status !== 404) {
    console.error(`R2 delete ${key} failed: ${res.status}`);
    process.exit(1);
  }
  console.log(`pruned ${key}`);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const CONTENT_TYPES: Record<string, string> = {
  ".apk": "application/vnd.android.package-archive",
  ".exe": "application/vnd.microsoft.portable-executable",
  ".dmg": "application/x-apple-diskimage",
  ".blockmap": "application/octet-stream",
  ".yml": "application/yaml",
  ".AppImage": "application/x-executable",
};

function contentTypeFor(name: string): string {
  for (const [ext, type] of Object.entries(CONTENT_TYPES)) {
    if (name.endsWith(ext)) return type;
  }
  return "application/octet-stream";
}

// Artifact filenames carry the version (electron-builder NSIS output is
// "Kataria Syntex Biz App Setup <version>.exe"; AppImage/dmg/APK vary).
// Remote keys strip spaces for clean URLs.
function keyFor(file: string, folder: string): string {
  return `${PREFIX}/${folder}/${basename(file).replaceAll(" ", "-")}`;
}

const files = walk(DIST);
const winSetup = files.find((f) => basename(f).endsWith(".exe"));
const winBlockmap = files.find((f) => basename(f).endsWith(".exe.blockmap"));
const winYml = files.find((f) => basename(f) === "latest.yml");
const linuxImage = files.find((f) => basename(f).endsWith(".AppImage"));
const linuxYml = files.find((f) => basename(f) === "latest-linux.yml");
const macDmg = files.find((f) => basename(f).endsWith(".dmg"));
const macBlockmap = files.find((f) => basename(f).endsWith(".dmg.blockmap"));
const apk = files.find((f) => basename(f).endsWith(".apk"));

// Push builds only publish when the version actually changed (Q8: bumping
// package.json is the release action). Manual dispatch always publishes.
if (process.env.ONLY_IF_VERSION_CHANGED === "1") {
  const current = await api(
    "GET",
    encodeURIComponent(`${PREFIX}/android/latest.json`),
  );
  if (current.ok) {
    const body: unknown = await current.json();
    const published =
      body !== null && typeof body === "object"
        ? (body as { version?: unknown }).version
        : undefined;
    if (published === VERSION) {
      console.log(
        `v${VERSION} is already published — skipping (version unchanged on push).`,
      );
      process.exit(0);
    }
  }
  // 404 / unparsable: nothing published yet — continue.
}

const missing = [
  ["win setup", winSetup],
  ["win latest.yml", winYml],
  ["linux AppImage", linuxImage],
  ["linux latest-linux.yml", linuxYml],
  ["mac dmg", macDmg],
  ["android apk", apk],
].filter(([, v]) => !v);
if (missing.length) {
  console.error(
    `Missing artifacts in ${DIST}: ${missing.map(([n]) => n).join(", ")}`,
  );
  process.exit(1);
}

// 1) Upload versioned artifacts (immutable cache) + blockmaps + ymls.
const ARTIFACT_CACHE = "public, max-age=31536000, immutable";
const uploads: Array<[string, string, string, string]> = [];
if (winSetup)
  uploads.push([
    keyFor(winSetup, "desktop/win"),
    winSetup,
    CONTENT_TYPES[".exe"]!,
    ARTIFACT_CACHE,
  ]);
if (winBlockmap)
  uploads.push([
    keyFor(winBlockmap, "desktop/win"),
    winBlockmap,
    CONTENT_TYPES[".blockmap"]!,
    ARTIFACT_CACHE,
  ]);
if (winYml)
  uploads.push([
    keyFor(winYml, "desktop/win"),
    winYml,
    CONTENT_TYPES[".yml"]!,
    "public, max-age=60",
  ]);
if (linuxImage)
  uploads.push([
    keyFor(linuxImage, "desktop/linux"),
    linuxImage,
    CONTENT_TYPES[".AppImage"]!,
    ARTIFACT_CACHE,
  ]);
if (linuxYml)
  uploads.push([
    keyFor(linuxYml, "desktop/linux"),
    linuxYml,
    CONTENT_TYPES[".yml"]!,
    "public, max-age=60",
  ]);
if (macDmg)
  uploads.push([
    keyFor(macDmg, "desktop/mac"),
    macDmg,
    CONTENT_TYPES[".dmg"]!,
    ARTIFACT_CACHE,
  ]);
if (macBlockmap)
  uploads.push([
    keyFor(macBlockmap, "desktop/mac"),
    macBlockmap,
    CONTENT_TYPES[".blockmap"]!,
    ARTIFACT_CACHE,
  ]);
if (apk)
  uploads.push([
    keyFor(apk, "android"),
    apk,
    CONTENT_TYPES[".apk"]!,
    ARTIFACT_CACHE,
  ]);

for (const [key, file, type, cache] of uploads) {
  await putObject(key, readFileSync(file), type, cache);
}

// 2) The unified manifest — Android + macOS Electron + /download page read it.
const manifest = {
  version: VERSION,
  minVersion: readMinVersion(),
  releasedAt: new Date().toISOString(),
  android: apk ? { apk: `/${keyFor(apk, "android")}` } : {},
  desktop: {
    ...(winSetup ? { win: `/${keyFor(winSetup, "desktop/win")}` } : {}),
    ...(macDmg ? { mac: `/${keyFor(macDmg, "desktop/mac")}` } : {}),
    ...(linuxImage ? { linux: `/${keyFor(linuxImage, "desktop/linux")}` } : {}),
  },
};
await putObject(
  `${PREFIX}/android/latest.json`,
  JSON.stringify(manifest, null, 2),
  "application/json",
  "public, max-age=60",
);

// 3) Latest-only retention: delete everything under app/ that this release
// did not just upload.
const keep = new Set<string>(uploads.map(([key]) => key));
keep.add(`${PREFIX}/android/latest.json`);
for (const key of await listKeys()) {
  if (!keep.has(key)) await deleteObject(key);
}

console.log(`v${VERSION} published (latest-only retention applied)`);

function readMinVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as { minAppVersion?: unknown; version?: unknown };
    return typeof pkg.minAppVersion === "string"
      ? pkg.minAppVersion
      : (pkg.version ?? VERSION);
  } catch {
    return VERSION;
  }
}
