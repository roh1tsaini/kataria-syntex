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
