import { GlobalProceduralCounts, IGalaxy } from "../../../interfaces/Galaxy.port";

export class GetGlobalProceduralCounts {
  constructor(private readonly galaxyRepo: IGalaxy) {}

  async execute(): Promise<GlobalProceduralCounts> {
    return this.galaxyRepo.getGlobalProceduralCounts();
  }
}
