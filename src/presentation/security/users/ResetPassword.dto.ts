import { z } from "zod";

export const ResetPasswordDTO = z.object({
  email: z.email(),
});

export type ResetPasswordDTO = z.infer<typeof ResetPasswordDTO>;
