/**
 * NativeWind 4 is built for Tailwind v3; the rest of this repo is on Tailwind v4.
 * The two versions conflict, so `bun install` hoists v4 to the repo root and
 * nests v3 inside this app - but NativeWind is hoisted next to v4, and its own
 * `require("tailwindcss/...")` calls (metro plugin, preset) resolve from its own
 * folder. They would find v4 and fail with "NativeWind only supports Tailwind
 * CSS v3" or ERR_PACKAGE_PATH_NOT_EXPORTED.
 *
 * This links the app's v3 into NativeWind's own node_modules, so every
 * `require("tailwindcss/...")` inside NativeWind resolves v3. It runs from the
 * root postinstall, so each `bun install` restores it.
 *
 * Delete this script when NativeWind supports Tailwind v4.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const NATIVEWIND_DIR = join(REPO_ROOT, "node_modules/nativewind");
const TAILWIND_V3_DIR = join(REPO_ROOT, "apps/mobile/node_modules/tailwindcss");
const LINK_PATH = join(NATIVEWIND_DIR, "node_modules/tailwindcss");
const TAILWIND_V3_MANIFEST = join(TAILWIND_V3_DIR, "package.json");

if (!existsSync(NATIVEWIND_DIR)) {
  console.log("nativewind is not installed, nothing to link");
  process.exit(0);
}

if (!existsSync(TAILWIND_V3_MANIFEST)) {
  throw new Error(
    "apps/mobile/node_modules/tailwindcss is missing - run `bun install` from the repo root",
  );
}

const version = JSON.parse(readFileSync(TAILWIND_V3_MANIFEST, "utf8")).version;
if (typeof version !== "string" || !version.startsWith("3.")) {
  throw new Error(
    `nativewind needs tailwindcss v3, but apps/mobile resolved ${String(version)}`,
  );
}

const isLinked = (): boolean => {
  if (!existsSync(LINK_PATH)) return false;
  try {
    return realpathSync(LINK_PATH) === realpathSync(TAILWIND_V3_DIR);
  } catch {
    return false;
  }
};

if (isLinked()) process.exit(0);

rmSync(LINK_PATH, { recursive: true, force: true });
mkdirSync(dirname(LINK_PATH), { recursive: true });
// A junction is a plain directory link on Windows - no admin rights needed.
symlinkSync(
  TAILWIND_V3_DIR,
  LINK_PATH,
  process.platform === "win32" ? "junction" : "dir",
);

console.log(`linked nativewind -> tailwindcss ${version}`);
