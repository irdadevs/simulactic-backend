import { z } from "zod";

export const SetAdminNoteDTO = z.object({
  note: z.string().trim().min(1).max(4000),
});

export type SetAdminNoteDTO = z.infer<typeof SetAdminNoteDTO>;
