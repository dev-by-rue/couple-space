import { z } from "zod";

export const loginSchema = z.object({
  email: z.email().transform((e) => e.trim().toLowerCase()),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
