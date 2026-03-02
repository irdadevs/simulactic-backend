import { z } from "zod";

export const CreateDonationCheckoutDTO = z.object({
  donationType: z.enum(["one_time", "monthly"]),
  amountMinor: z.number().int().positive().max(5_000_000_00),
  currency: z.string().length(3),
  successUrl: z.url(),
  cancelUrl: z.url(),
  customerEmail: z.email().optional(),
});

export type CreateDonationCheckoutDTO = z.infer<typeof CreateDonationCheckoutDTO>;
