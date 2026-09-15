/**
 * Semver (x.y.z) comparison for the update system — the server's
 * `update_required` gate and every client's "is a newer version out?"
 * check run this. Deliberately dependency-free and strict: versions come
 * from package.json, never from user input, so anything unparseable
 * counts as "oldest" and a force-update wins.
 *
 * Returns a negative number when a < b, positive when a > b, 0 when equal.
 */
export function compareSemver(a: string, b: string): number {
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

/**
 * `minAppVersion` when no breaking change has shipped — the package.json
 * default. `0.0.0` is falsy-looking but a TRUTHY string, so any code that
 * tests the raw value (rather than the predicate below) treats "no floor" as
 * a real one and arms the blocking update dialog on every client.
 */
const NO_UPDATE_FLOOR = "0.0.0";

/**
 * True only when a minVersion value actually forces an update. Anything
 * absent or equal to the sentinel means "no floor": the caller must ignore
 * it rather than raise the undismissable update dialog.
 */
export function hasUpdateFloor(minVersion: string | null | undefined): boolean {
  if (typeof minVersion !== "string") return false;
  if (minVersion.trim() === "") return false;
  return compareSemver(minVersion, NO_UPDATE_FLOOR) > 0;
}

function parse(v: string): [number, number, number] {
  const parts = v.trim().replace(/^v/, "").split(".");
  const num = (s: string | undefined) => {
    const n = Number.parseInt(s ?? "", 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  return [num(parts[0]), num(parts[1]), num(parts[2])];
}
