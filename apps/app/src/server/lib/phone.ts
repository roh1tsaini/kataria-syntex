/**
 * Phone normalization: India-first.
 * Accepts 10-digit Indian numbers (normalized to +91...), 0-prefixed 11-digit,
 * and raw E.164 (+CC...). Returns E.164 or null when invalid.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (
    digits.length === 11 &&
    digits.startsWith("0") &&
    /^[6-9]/.test(digits.slice(1))
  )
    return `+91${digits.slice(1)}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return null;
}
