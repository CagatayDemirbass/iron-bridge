import { z } from "zod";

export const submitMessageBodySchema = z.object({
  tenant: z.string().min(1),
  participant: z.string().min(1),
  body: z.string().min(1),
  unitId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(1).optional(),
  participantKind: z.enum(["human", "agent", "system"]).default("human"),
  dispatchAgent: z.boolean().optional()
});

export const unitParamsSchema = z.object({
  unitId: z.string().uuid()
});

export const tenantQuerySchema = z.object({
  tenant: z.string().min(1)
});
