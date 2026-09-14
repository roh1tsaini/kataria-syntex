/**
 * UUID-shaped ids that work outside secure contexts (plain-http LAN).
 *
 * Never Math.random — low entropy invites collisions in idempotency keys and
 * device fingerprints. Used for the challan `clientRef` the server dedupes on,
 * the per-browser device fingerprint, and the realtime client id.
 */
export function randomId(): string {
  const c = globalThis.crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  // set version 4 bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return Array.from(bytes, (b, i) =>
    [4, 6, 8, 10].includes(i)
      ? `-${b.toString(16).padStart(2, "0")}`
      : b.toString(16).padStart(2, "0"),
  ).join("");
}
