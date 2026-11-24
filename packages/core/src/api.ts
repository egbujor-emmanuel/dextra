import { z } from 'zod'

/** Glasses ↔ server contract. Both sides import these schemas; neither redefines shapes. */

export const lensCommitmentSchema = z.object({
  id: z.string(),
  by: z.enum(['wearer', 'counterparty']),
  what: z.string(),
  dueISO: z.string().optional(),
  amount: z.string().optional(),
  done: z.boolean(),
  line: z.string(),
})

export const contactSchema = z.object({ id: z.string(), name: z.string() })

export const agreementViewSchema = z.object({
  id: z.string(),
  status: z.enum(['draft', 'sent', 'amended', 'confirmed', 'fulfilled', 'discarded', 'expired']),
  counterpartyName: z.string(),
  commitments: z.array(lensCommitmentSchema),
  proposed: z.array(lensCommitmentSchema).optional(),
  amendNote: z.string().optional(),
  warnings: z.array(z.string()),
  contact: contactSchema.optional(),
  hash: z.string().optional(),
})

export const refusalSchema = z.object({
  refusal: z.string(),
  message: z.string(),
})

export const captureResponseSchema = z.union([
  z.object({ agreement: agreementViewSchema, contacts: z.array(contactSchema) }),
  refusalSchema,
])

export const deviceRegisterResponseSchema = z.object({ deviceId: z.string(), deviceToken: z.string() })
export const pairCodeResponseSchema = z.object({ code: z.string(), expiresAt: z.string(), botUsername: z.string() })
export const deviceStateSchema = z.object({
  paired: z.boolean(),
  wearerName: z.string().optional(),
  businessConnected: z.boolean(),
  open: z.number().int(),
  dueSoon: z.number().int(),
})

export const serverEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('agreement'), agreement: agreementViewSchema }),
  z.object({ type: z.literal('paired'), wearerName: z.string() }),
  z.object({ type: z.literal('ping') }),
])

export type LensCommitment = z.infer<typeof lensCommitmentSchema>
export type Contact = z.infer<typeof contactSchema>
export type AgreementView = z.infer<typeof agreementViewSchema>
export type Refusal = z.infer<typeof refusalSchema>
export type CaptureResponse = z.infer<typeof captureResponseSchema>
export type DeviceState = z.infer<typeof deviceStateSchema>
export type ServerEvent = z.infer<typeof serverEventSchema>
