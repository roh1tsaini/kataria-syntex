/**
 * CI release publisher — uploads built artifacts to the ks-releases R2
 * bucket via the Cloudflare REST API, writes the update manifests, and
 * verifies every published URL resolves before declaring success.
 *
 * Runs in .github/workflows/app-build.yml after the desktop/Android builds.
 * Latest-only retention: a new release replaces every previous object under
 * app/ (the 10 GB free tier stays empty; caches stay valid because artifact
 * filenames are versioned and only the manifests keep stable URLs).
 *
 * Artifact naming contract: electron-builder.yml's artifactName patterns
 * produce dash-named files; the same name is the R2 key and the filename
 * referenced inside latest*.yml. No renaming happens anywhere — builder
 * output, stored object and updater manifest all agree by construction.
 *
 * Env:
 *   CF_ACCOUNT_ID, CF_API_TOKEN  — R2 edit token (Workers R2 Storage Edit)
 *   R2_BUCKET                    — bucket name (ks-releases)
 *   VERSION                      — app version being published
 *   DIST_DIR                     — directory with downloaded artifacts
 *   RELEASES_ORIGIN              — public origin serving /releases/* (smoke
 *                                  check target); defaults to the app Worker.
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
const RELEASES_ORIGIN = `https://${(
  process.env.RELEASES_ORIGIN ?? "app.katariasyntex.workers.dev"
).replace(/^https?:\/\//, "")}`.replace(/\/$/, "");
const PREFIX = "app";

if (!ACCOUNT || !TOKEN || !VERSION) {
  console.error(
    "CF_ACCOUNT_ID, CF_API_TOKEN and VERSION are required to publish releases.",
  );
  process.exit(1);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const OBJECTS_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/objects`;

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return { Authorization: `Bearer ${TOKEN}`, ...extra };
}

async function putObject(
  key: string,
  data: Buffer,
  contentType: string,
  cacheControl: string,
): Promise<void> {
  const res = await fetch(`${OBJECTS_URL}/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: authHeaders({
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
    }),
    body: new Uint8Array(data),
  });
  if (!res.ok) fail(`R2 PUT ${key} failed: ${res.status} ${await res.text()}`);
  console.log(`uploaded ${key}`);
}

/** Lists keys currently under the app/ prefix (all pages). */
async function listKeys(): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const url = new URL(OBJECTS_URL);
    url.searchParams.set("prefix", `${PREFIX}/`);
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) fail(`R2 list failed: ${res.status} ${await res.text()}`);
    const body: unknown = await res.json();
    if (body === null || typeof body !== "object")
      fail("R2 list returned an unexpected body.");
    const root = body as {
      result?: unknown;
      result_info?: { cursor?: unknown };
    };
    if (Array.isArray(root.result)) {
      for (const item of root.result) {
        const k = (item as { key?: unknown }).key;
        if (typeof k === "string") keys.push(k);
      }
    }
    const info = root.result_info;
    cursor =
      info &&
      typeof info === "object" &&
      typeof info.cursor === "string" &&
      (info as { is_truncated?: unknown }).is_truncated === true
        ? info.cursor
        : undefined;
  } while (cursor);
  return keys;
}

async function deleteObject(key: string): Promise<void> {
  const res = await fetch(`${OBJECTS_URL}/${encodeURIComponent(key)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok && res.status !== 404)
    fail(`R2 delete ${key} failed: ${res.status}`);
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

/** R2 key for a built artifact: app/<folder>/<builder filename>. The builder
 * already emits dash-named files (electron-builder.yml artifactName), so the
 * key needs no transformation — the same name appears in latest*.yml. */
function keyFor(file: string, folder: string): string {
  return `${PREFIX}/${folder}/${basename(file)}`;
}

/** Public URL an artifact will download from. */
function releaseUrl(key: string): string {
  return `${RELEASES_ORIGIN}/releases/${key}`;
}

function readMinVersion(): string {
  const pkgPath = join(process.cwd(), "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    minAppVersion?: unknown;
  };
  if (typeof pkg.minAppVersion !== "string")
    fail(`${pkgPath} is missing a string "minAppVersion".`);
  return pkg.minAppVersion;
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

// Push builds only publish when the version actually changed (bumping
// package.json is the release action). Manual dispatch always publishes.
if (process.env.ONLY_IF_VERSION_CHANGED === "1") {
  const current = await fetch(
    `${OBJECTS_URL}/${encodeURIComponent(`${PREFIX}/android/latest.json`)}`,
    { headers: authHeaders() },
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
  fail(`Missing artifacts in ${DIST}: ${missing.map(([n]) => n).join(", ")}`);
}

// 1) Upload versioned artifacts (immutable cache) + blockmaps + updater ymls.
const ARTIFACT_CACHE = "public, max-age=31536000, immutable";
const uploads: Array<{ key: string; file: string }> = [];
if (winSetup)
  uploads.push({ key: keyFor(winSetup, "desktop/win"), file: winSetup });
if (winBlockmap)
  uploads.push({
    key: keyFor(winBlockmap, "desktop/win"),
    file: winBlockmap,
  });
if (winYml) uploads.push({ key: keyFor(winYml, "desktop/win"), file: winYml });
if (linuxImage)
  uploads.push({
    key: keyFor(linuxImage, "desktop/linux"),
    file: linuxImage,
  });
if (linuxYml)
  uploads.push({
    key: keyFor(linuxYml, "desktop/linux"),
    file: linuxYml,
  });
if (macDmg) uploads.push({ key: keyFor(macDmg, "desktop/mac"), file: macDmg });
if (macBlockmap)
  uploads.push({
    key: keyFor(macBlockmap, "desktop/mac"),
    file: macBlockmap,
  });
if (apk) uploads.push({ key: keyFor(apk, "android"), file: apk });

for (const { key, file } of uploads) {
  await putObject(
    key,
    readFileSync(file),
    contentTypeFor(basename(key)),
    basename(key).endsWith(".yml") ? "public, max-age=60" : ARTIFACT_CACHE,
  );
}

// 2) The unified manifest — Android + macOS Electron + /download page read it.
// Paths are the public /releases/* URLs every client resolves directly.
const manifest = {
  version: VERSION,
  minVersion: readMinVersion(),
  releasedAt: new Date().toISOString(),
  android: apk ? { apk: `/releases/${keyFor(apk, "android")}` } : {},
  desktop: {
    ...(winSetup
      ? { win: `/releases/${keyFor(winSetup, "desktop/win")}` }
      : {}),
    ...(macDmg ? { mac: `/releases/${keyFor(macDmg, "desktop/mac")}` } : {}),
    ...(linuxImage
      ? { linux: `/releases/${keyFor(linuxImage, "desktop/linux")}` }
      : {}),
  },
};
await putObject(
  `${PREFIX}/android/latest.json`,
  Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
  "application/json",
  "public, max-age=60",
);

// 3) Latest-only retention: delete everything under app/ that this release
// did not just upload.
const keep = new Set<string>(uploads.map(({ key }) => key));
keep.add(`${PREFIX}/android/latest.json`);
for (const key of await listKeys()) {
  if (!keep.has(key)) await deleteObject(key);
}

// 4) Smoke check — every public URL this release advertises must resolve on
// the live origin, and the updater ymls must reference the stored filenames.
// A release that fails here is broken for real clients; exit non-zero.
const publicUrls = [
  ...uploads
    .filter(({ key }) => !key.endsWith(".blockmap"))
    .map(({ key }) => releaseUrl(key)),
  releaseUrl(`${PREFIX}/android/latest.json`),
];
let smokeFailed = false;
for (const url of publicUrls) {
  const res = await fetch(url, { method: "HEAD" });
  if (res.ok) {
    console.log(`ok ${url}`);
  } else {
    smokeFailed = true;
    console.error(`SMOKE FAIL ${res.status} ${url}`);
  }
}
for (const [yml, artifact] of [
  [winYml, winSetup],
  [linuxYml, linuxImage],
] as const) {
  if (!yml || !artifact) continue;
  const text = readFileSync(yml, "utf8");
  if (!text.includes(basename(artifact))) {
    smokeFailed = true;
    console.error(
      `SMOKE FAIL ${basename(yml)} does not reference ${basename(artifact)} — updater would 404.`,
    );
  }
}
if (smokeFailed) fail("Release smoke check failed — see errors above.");

console.log(
  `v${VERSION} published and verified (latest-only retention applied)`,
);
