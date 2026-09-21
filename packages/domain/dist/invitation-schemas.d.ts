import { z } from "zod";
/**
 * Shared invitation request shape for Nest DTOs and web RHF.
 * Keep email normalize identical on client and server.
 */
export declare const createInvitationSchema: z.ZodObject<{
    email: z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodEmail>, z.ZodTransform<string, string>>;
}, z.core.$strip>;
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
