import z from "zod";

/** Longest answer a partner can submit. To be enforced by API and shown in web form. */
export const ANSWER_MAX_LENGTH = 5000;

export const submitAnswerSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "You must provide an answer before submitting.")
    .max(ANSWER_MAX_LENGTH, `Keep it under ${ANSWER_MAX_LENGTH} characters.`),
});

export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;
