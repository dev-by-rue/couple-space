import { z } from "zod";

export const createInvitationSchema = z.object({
  email: z.email().transform((e) => e.trim().toLowerCase()),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
