/**
 * Account identifiers people read on screen. Phones never show in full — the
 * last four digits are enough to recognise the account; emails are already
 * the display form.
 */
export function maskIdentifier(identifier: string): string {
  return identifier.includes("@")
    ? identifier
    : `••••• ${identifier.slice(-4)}`;
}
