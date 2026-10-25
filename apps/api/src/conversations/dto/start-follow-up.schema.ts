import { z } from "zod";

export const startFollowUpSchema = z.object({
  promptId: z.string().uuid(),
});

export type StartFollowUpInput = z.infer<typeof startFollowUpSchema>;
