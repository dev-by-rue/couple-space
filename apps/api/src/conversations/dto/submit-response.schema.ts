import { z } from "zod";

export const submitResponseSchema = z.object({
  text: z.string().trim().min(1).max(10000),
});

export type SubmitResponseInput = z.infer<typeof submitResponseSchema>;
