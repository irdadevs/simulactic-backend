import { ErrorFactory } from "../../../../utils/errors/Error.map";
import { LogCacheService } from "../../../app-services/logs/LogCache.service";
import { ILog } from "../../../interfaces/Log.port";

export class ClearAdminNote {
  constructor(
    private readonly repo: ILog,
    private readonly cache: LogCacheService,
  ) {}

  async execute(id: string, byUserId: string): Promise<void> {
    const found = await this.repo.findById(id);
    if (!found) {
      throw ErrorFactory.presentation("SHARED.NOT_FOUND", { sourceType: "log", id });
    }

    found.clearAdminNote(byUserId);
    await this.repo.clearAdminNote(id, byUserId);
    await this.cache.invalidateForMutation(id);
  }
}
