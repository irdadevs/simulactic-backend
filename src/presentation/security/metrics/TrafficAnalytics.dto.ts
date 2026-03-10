import { z } from "zod";

export const TrafficAnalyticsDTO = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    limitRecent: z.coerce.number().int().min(1).max(200).optional(),
    limitRoutes: z.coerce.number().int().min(1).max(200).optional(),
    limitReferrers: z.coerce.number().int().min(1).max(200).optional(),
  })
  .refine((value) => value.from <= value.to, {
    message: "from must be before or equal to to",
    path: ["from"],
  });

export type TrafficAnalyticsDTO = z.infer<typeof TrafficAnalyticsDTO>;
