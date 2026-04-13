import { z } from 'zod';

export const ServiceAddressSchema = z
  .object({
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  })
  .optional();

export const IntakePayloadSchema = z
  .object({
    formId: z.string().optional(), // idempotency key
    submittedAt: z.string().datetime().optional(),
    source: z.string().optional(),
    name: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: ServiceAddressSchema,
    serviceType: z.string().min(1),
    frequency: z.string().optional(),
    squareFeet: z.number().int().positive().optional(),
    bedrooms: z.number().int().positive().optional(),
    bathrooms: z.number().positive().optional(),
    addOns: z.array(z.string()).optional(),
    estimateShown: z.number().positive().optional(),
    notes: z.string().optional(),
  })
  .strict()
  .passthrough(); // allow extra fields to be passed through for audit

export type IntakePayload = z.infer<typeof IntakePayloadSchema>;

export const IntakePayloadResponseSchema = z.object({
  ok: z.boolean(),
  quoteId: z.string().uuid().optional(),
  opportunityId: z.string().uuid().optional(),
  personId: z.string().uuid().optional(),
  quoteNumber: z.string().optional(),
  errors: z
    .array(
      z.object({
        field: z.string(),
        message: z.string(),
      }),
    )
    .optional(),
  error: z.string().optional(),
});

export type IntakePayloadResponse = z.infer<typeof IntakePayloadResponseSchema>;
