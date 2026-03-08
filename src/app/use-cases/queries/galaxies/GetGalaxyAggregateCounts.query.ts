import { Uuid } from "../../../../domain/aggregates/User";
import { GalaxyAggregateCounts, IGalaxy } from "../../../interfaces/Galaxy.port";

export class GetGalaxyAggregateCounts {
  constructor(private readonly galaxyRepo: IGalaxy) {}

  async execute(galaxyId: Uuid): Promise<GalaxyAggregateCounts> {
    return this.galaxyRepo.getAggregateCounts(galaxyId);
  }
}
