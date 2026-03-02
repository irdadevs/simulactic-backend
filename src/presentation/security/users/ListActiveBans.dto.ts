import { z } from "zod";

export const ListActiveBansDTO = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export type ListActiveBansDTO = z.infer<typeof ListActiveBansDTO>;
