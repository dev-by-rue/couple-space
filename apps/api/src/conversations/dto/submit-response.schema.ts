import { z } from "zod";
import { ANSWER_MAX_LENGTH } from "@couple-space/domain";

export const submitResponseSchema = z.object({
  text: z.string().trim().min(1).max(ANSWER_MAX_LENGTH),
});

export type SubmitResponseInput = z.infer<typeof submitResponseSchema>;
