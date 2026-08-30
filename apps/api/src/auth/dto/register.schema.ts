import { z } from "zod";

/**
 * Password policy: min 12 + upper/lower/digit.
 * Product profile: displayName + dateOfBirth required at signup.
 */
export const registerSchema = z.object({
  email: z.email().transform((e) => e.trim().toLowerCase()),
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

export type RegisterInput = z.infer<typeof registerSchema>;
