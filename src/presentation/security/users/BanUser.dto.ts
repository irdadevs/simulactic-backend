import { z } from "zod";

export const BanUserDTO = z.object({
  reason: z.string().trim().min(5).max(400),
  expiresAt: z.coerce.date().optional(),
});

export type BanUserDTO = z.infer<typeof BanUserDTO>;
