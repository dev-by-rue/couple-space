import { z } from "zod";

const passwordSchema = z
  .string()
  .min(12)
  .regex(/[a-z]/, "password needs a lowercase letter")
  .regex(/[A-Z]/, "password needs an uppercase letter")
  .regex(/[0-9]/, "password needs a digit");

const displayNameSchema = z.string().trim().min(1).max(40);

/**
 * Shared auth request shapes for Nest DTOs and web RHF.
 * Keep password policy and profile fields identical on client and server
 * so validation drift cannot open an accept-then-reject gap.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .pipe(z.email())
    .transform((e) => e.toLowerCase()),
  password: z.string().min(1),
});

/**
 * Password policy: min 12 + upper/lower/digit.
 * Product profile: displayName + dateOfBirth required at signup.
 * Age-gate policy using DOB is explicitly out of Slice 1 — collect only.
 */
export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .pipe(z.email())
    .transform((e) => e.toLowerCase()),
  password: passwordSchema,
  displayName: displayNameSchema,
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD"),
});

export const updateProfileSchema = z.object({
  displayName: displayNameSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "new password must not be the same as current password",
    path: ["newPassword"],
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
