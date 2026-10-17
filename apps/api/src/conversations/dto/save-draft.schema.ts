import { z } from "zod";
import { ANSWER_MAX_LENGTH } from "@couple-space/domain";

export const saveDraftSchema = z.object({
  text: z.string().max(ANSWER_MAX_LENGTH),
});

export type SaveDraftInput = z.infer<typeof saveDraftSchema>;
