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

function parse(v: string): [number, number, number] {
  const parts = v.trim().replace(/^v/, "").split(".");
  const num = (s: string | undefined) => {
    const n = Number.parseInt(s ?? "", 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  return [num(parts[0]), num(parts[1]), num(parts[2])];
}
