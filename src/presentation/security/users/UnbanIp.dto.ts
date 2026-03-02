import { z } from "zod";

const isLikelyIp = (value: string): boolean => {
  const candidate = value.trim().replace(/^::ffff:/i, "");
  if (!candidate) return false;
  if (candidate.includes(":")) return true;
  const parts = candidate.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
};

export const UnbanIpDTO = z.object({
  ipAddress: z.string().trim().refine(isLikelyIp, {
    message: "Invalid IP address",
  }),
});

export type UnbanIpDTO = z.infer<typeof UnbanIpDTO>;
