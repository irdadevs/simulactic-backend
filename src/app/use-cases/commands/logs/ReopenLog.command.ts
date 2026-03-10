import { ErrorFactory } from "../../../../utils/errors/Error.map";
import { LogCacheService } from "../../../app-services/logs/LogCache.service";
import { ILog } from "../../../interfaces/Log.port";

export class ReopenLog {
  constructor(
    private readonly repo: ILog,
    private readonly cache: LogCacheService,
  ) {}

  async execute(id: string): Promise<void> {
    const found = await this.repo.findById(id);
    if (!found) {
      throw ErrorFactory.presentation("SHARED.NOT_FOUND", { sourceType: "log", id });
    }

    if (!found.canBeReopened()) {
      throw ErrorFactory.presentation("PRESENTATION.INVALID_FIELD", { field: "reopen" });
    }

    await this.repo.reopen(id);
    await this.cache.invalidateForMutation(id);
  }
}
