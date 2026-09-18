import { z } from "zod";

/** Shared between the inquiry form (client) and the API route (server). */
export const inquirySchema = z.object({
  name: z.string().trim().min(2, "Please share your name.").max(120),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  email: z.string().trim().email("A valid email helps us reply.").max(160),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
  product: z.string().trim().max(120).optional().or(z.literal("")),
  shade: z.string().trim().max(40).optional().or(z.literal("")),
  quantity: z.string().trim().max(120).optional().or(z.literal("")),
  message: z
    .string()
    .trim()
    .min(10, "A few words about the requirement helps us quote faster.")
    .max(4000),
  // Honeypot — accepts anything so bots get a silent fake success;
  // the route discards submissions where this is non-empty.
  website: z.string().optional(),
});

export type InquiryInput = z.infer<typeof inquirySchema>;

/** Indian Goods and Services Tax Identification Number (15 alphanumeric characters). */
export const GSTIN_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/** Permanent Account Number (10 alphanumeric characters). */
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export function isValidGstin(val: string): boolean {
  return GSTIN_REGEX.test(val.trim().toUpperCase());
}

export function isValidPan(val: string): boolean {
  return PAN_REGEX.test(val.trim().toUpperCase());
}

export const gstinSchema = z
  .string()
  .trim()
  .max(15)
  .optional()
  .default("")
  .transform((v) => v.toUpperCase())
  .refine(
    (v) => !v || GSTIN_REGEX.test(v),
    "Invalid GSTIN format (e.g. 27ABCDE1234F1Z5)",
  );

export const panSchema = z
  .string()
  .trim()
  .max(10)
  .optional()
  .default("")
  .transform((v) => v.toUpperCase())
  .refine(
    (v) => !v || PAN_REGEX.test(v),
    "Invalid PAN format (e.g. ABCDE1234F)",
  );
