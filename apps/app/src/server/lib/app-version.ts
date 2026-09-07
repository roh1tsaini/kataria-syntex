/**
 * The deployed app version and the force-update floor, read from
 * apps/app/package.json at bundle time. `version` is what CI publishes;
 * `minAppVersion` is the owner's breaking-change contract (AGENTS.md §4.0.1):
 * bump it when a deploy breaks older clients and every API call from a
 * client below it answers 426 update_required.
 */
import pkg from "../../../package.json";

const pkgVersion = (pkg as { version?: unknown }).version;
const pkgMin = (pkg as { minAppVersion?: unknown }).minAppVersion;

export const APP_VERSION: string =
  typeof pkgVersion === "string" ? pkgVersion : "0.0.0";
export const MIN_APP_VERSION: string =
  typeof pkgMin === "string" ? pkgMin : "0.0.0";

/** True when the API enforces the version floor (minAppVersion set > 0.0.0). */
export const VERSION_GATE_ENABLED: boolean = MIN_APP_VERSION !== "0.0.0";
