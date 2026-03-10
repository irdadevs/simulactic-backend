import { z } from "zod";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseTrafficBoundary = (field: "from" | "to") =>
  z.string().trim().min(1).transform((value, ctx) => {
    let parsed: Date;

    if (DATE_ONLY_PATTERN.test(value)) {
      parsed =
        field === "from"
          ? new Date(`${value}T00:00:00.000Z`)
          : new Date(`${value}T23:59:59.999Z`);
    } else {
      parsed = new Date(value);
    }

    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `invalid ${field} date`,
      });
      return z.NEVER;
    }

    return parsed;
  });

export const TrafficAnalyticsDTO = z
  .object({
    from: parseTrafficBoundary("from"),
    to: parseTrafficBoundary("to"),
    limitRecent: z.coerce.number().int().min(1).max(200).optional(),
    limitRoutes: z.coerce.number().int().min(1).max(200).optional(),
    limitReferrers: z.coerce.number().int().min(1).max(200).optional(),
  })
  .refine((value) => value.from <= value.to, {
    message: "from must be before or equal to to",
    path: ["from"],
  })
  .refine((value) => value.to.getTime() - value.from.getTime() <= 366 * 24 * 60 * 60 * 1000, {
    message: "date range must be 366 days or less",
    path: ["to"],
  });

export type TrafficAnalyticsDTO = z.infer<typeof TrafficAnalyticsDTO>;
