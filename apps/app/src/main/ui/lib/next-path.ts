/** Post-sign-in destination carried in `?next=`. Only same-origin absolute
 * paths are accepted — a protocol-relative (`//evil.test`) or absolute URL
 * would bounce a fresh session off-site. */
export function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}
