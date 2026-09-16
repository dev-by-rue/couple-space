import { z } from "zod";
/**
 * Shared auth request shapes for Nest DTOs and web RHF.
 * Keep password policy and profile fields identical on client and server
 * so validation drift cannot open an accept-then-reject gap.
 */
export const loginSchema = z.object({
    email: z.string().trim().pipe(z.email()).transform((e) => e.toLowerCase()),
    password: z.string().min(1),
});
/**
 * Password policy: min 12 + upper/lower/digit.
 * Product profile: displayName + dateOfBirth required at signup.
 * Age-gate policy using DOB is explicitly out of Slice 1 — collect only.
 */
export const registerSchema = z.object({
    email: z.string().trim().pipe(z.email()).transform((e) => e.toLowerCase()),
    password: z
        .string()
        .min(12)
        .regex(/[a-z]/, "password needs a lowercase letter")
        .regex(/[A-Z]/, "password needs an uppercase letter")
        .regex(/[0-9]/, "password needs a digit"),
    displayName: z.string().trim().min(1).max(100),
    dateOfBirth: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD"),
});
