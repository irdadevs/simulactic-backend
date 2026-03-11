import { z } from "zod";

export const CreateCustomerPortalSessionDTO = z.object({
  returnUrl: z.url(),
});

export type CreateCustomerPortalSessionDTO = z.infer<typeof CreateCustomerPortalSessionDTO>;
