/** Form guards shared by the document editors. Server zod schemas reject NaN,
 * Infinity, zero/negative required weights and fractional integer counts; keep
 * those failures local to the form instead of making the user wait for a 422. */

export const isPositiveNumber = (raw: string): boolean => {
  const value = Number(raw.trim());
  return raw.trim() !== "" && Number.isFinite(value) && value > 0;
};

export const isOptionalNonNegativeNumber = (raw: string): boolean => {
  if (raw.trim() === "") return true;
  const value = Number(raw.trim());
  return Number.isFinite(value) && value >= 0;
};

export const isOptionalNonNegativeInteger = (raw: string): boolean => {
  if (raw.trim() === "") return true;
  const value = Number(raw.trim());
  return Number.isSafeInteger(value) && value >= 0;
};
