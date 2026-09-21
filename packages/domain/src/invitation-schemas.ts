import { z } from "zod";

/**
 * Shared invitation request shape for Nest DTOs and web RHF.
 * Keep email normalize identical on client and server.
 */
export const createInvitationSchema = z.object({
  email: z.string().trim().pipe(z.email()).transform((e) => e.toLowerCase()),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
