import { normalizePhone } from "./phone";

/**
 * A login identifier is a phone number or an email address — auto-detected
 * by format. Phones normalize to E.164 (India-first), emails are lowercased.
 */
type IdentifierType = "phone" | "email";

export type Identifier = {
  type: IdentifierType;
  value: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function detectIdentifier(input: string): Identifier | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.includes("@")) {
    if (!EMAIL_RE.test(trimmed) || trimmed.length > 200) return null;
    return { type: "email", value: trimmed.toLowerCase() };
  }
  const phone = normalizePhone(trimmed);
  return phone ? { type: "phone", value: phone } : null;
}
