import { z } from "zod";
import { ALLOWED_PLANET_BIOMES } from "../../../domain/aggregates/Planet";

export const ChangePlanetBiomeDTO = z.object({
  biome: z.enum(ALLOWED_PLANET_BIOMES),
});

export type ChangePlanetBiomeDTO = z.infer<typeof ChangePlanetBiomeDTO>;
