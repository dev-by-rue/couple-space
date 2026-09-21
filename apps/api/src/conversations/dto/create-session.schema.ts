import { z } from "zod";

export const createSessionSchema = z.object({
  promptId: z.string().uuid(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
