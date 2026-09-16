import { z } from "zod";
/**
 * Shared auth request shapes for Nest DTOs and web RHF.
 * Keep password policy and profile fields identical on client and server
 * so validation drift cannot open an accept-then-reject gap.
 */
export declare const loginSchema: z.ZodObject<{
    email: z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodEmail>, z.ZodTransform<string, string>>;
    password: z.ZodString;
}, z.core.$strip>;
export type LoginInput = z.infer<typeof loginSchema>;
/**
 * Password policy: min 12 + upper/lower/digit.
 * Product profile: displayName + dateOfBirth required at signup.
 * Age-gate policy using DOB is explicitly out of Slice 1 — collect only.
 */
export declare const registerSchema: z.ZodObject<{
    email: z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodEmail>, z.ZodTransform<string, string>>;
    password: z.ZodString;
    displayName: z.ZodString;
    dateOfBirth: z.ZodString;
}, z.core.$strip>;
export type RegisterInput = z.infer<typeof registerSchema>;
