import { ICache } from "../../interfaces/Cache.port";
import { System, SystemPositionProps } from "../../../domain/aggregates/System";
import {
  CachedListSystemsByGalaxyResult,
  CachedSystem,
  SYSTEM_CACHE_POLICY,
  SystemCacheKeys,
  deserializeSystemFromCache,
  serializeSystemForCache,
} from "../../../utils/cache/SystemCache";

type SystemIdentitySnapshot = {
  name: string;
  position: SystemPositionProps;
  galaxyId: string;
};

type SystemDeleteSnapshot = {
  id: string;
  name: string;
  position: SystemPositionProps;
  galaxyId: string;
};

export class SystemCacheService {
  constructor(private readonly cache: ICache) {}

  async getById(id: string): Promise<System | null> {
    try {
      const cached = await this.cache.get<CachedSystem>(SystemCacheKeys.byId(id));
      return cached ? deserializeSystemFromCache(cached) : null;
    } catch {
      return null;
    }
  }

  async getByName(name: string): Promise<System | null> {
    try {
      const cached = await this.cache.get<CachedSystem>(SystemCacheKeys.byName(name));
      return cached ? deserializeSystemFromCache(cached) : null;
    } catch {
      return null;
    }
  }

  async getByPosition(position: SystemPositionProps): Promise<System | null> {
    try {
      const cached = await this.cache.get<CachedSystem>(
        SystemCacheKeys.byPosition(position),
      );
      return cached ? deserializeSystemFromCache(cached) : null;
    } catch {
      return null;
    }
  }

  async setSystem(system: System): Promise<void> {
    const payload = serializeSystemForCache(system);
    const ttl = SYSTEM_CACHE_POLICY.systemTtl;

    try {
      await this.cache.set(SystemCacheKeys.byId(system.id), payload, ttl);
      await this.cache.set(SystemCacheKeys.byName(system.name), payload, ttl);
      await this.cache.set(SystemCacheKeys.byPosition(system.position), payload, ttl);
    } catch {
      return;
    }
  }

  async getListByGalaxy(galaxyId: string): Promise<{ rows: System[]; total: number } | null> {
    try {
      const cached = await this.cache.get<CachedListSystemsByGalaxyResult>(
        SystemCacheKeys.listByGalaxy(galaxyId),
      );
      if (!cached) return null;
      return {
        rows: cached.rows.map((row) => deserializeSystemFromCache(row)),
        total: cached.total,
      };
    } catch {
      return null;
    }
  }

  async setListByGalaxy(
    galaxyId: string,
    result: { rows: System[]; total: number },
  ): Promise<void> {
    const payload: CachedListSystemsByGalaxyResult = {
      rows: result.rows.map((row) => serializeSystemForCache(row)),
      total: result.total,
    };

    try {
      await this.cache.set(
        SystemCacheKeys.listByGalaxy(galaxyId),
        payload,
        SYSTEM_CACHE_POLICY.systemsListTtl,
      );
    } catch {
      return;
    }
  }

  async invalidateForMutation(
    current: System,
    previous?: SystemIdentitySnapshot,
  ): Promise<void> {
    const keys = [
      SystemCacheKeys.byId(current.id),
      SystemCacheKeys.byName(current.name),
      SystemCacheKeys.byPosition(current.position),
      SystemCacheKeys.listByGalaxy(current.galaxyId),
    ];

    if (previous) {
      keys.push(SystemCacheKeys.byName(previous.name));
      keys.push(SystemCacheKeys.byPosition(previous.position));
      keys.push(SystemCacheKeys.listByGalaxy(previous.galaxyId));
    }

    try {
      await this.cache.delMany(Array.from(new Set(keys)));
      // Non-unique findByName/findByPosition semantics require broad invalidation.
      await this.cache.delByPrefix(SystemCacheKeys.byNamePrefix());
      await this.cache.delByPrefix(SystemCacheKeys.byPositionPrefix());
    } catch {
      return;
    }
  }

  async invalidateListByGalaxy(galaxyId: string): Promise<void> {
    try {
      await this.cache.del(SystemCacheKeys.listByGalaxy(galaxyId));
    } catch {
      return;
    }
  }

  async invalidateForDelete(snapshot: {
    id: string;
    galaxyId: string;
    name: string;
    position: SystemPositionProps;
  }): Promise<void> {
    try {
      await this.cache.delMany([
        SystemCacheKeys.byId(snapshot.id),
        SystemCacheKeys.byName(snapshot.name),
        SystemCacheKeys.byPosition(snapshot.position),
        SystemCacheKeys.listByGalaxy(snapshot.galaxyId),
      ]);
      await this.cache.delByPrefix(SystemCacheKeys.byNamePrefix());
      await this.cache.delByPrefix(SystemCacheKeys.byPositionPrefix());
    } catch {
      return;
    }
  }

  async invalidateForDeletedGalaxy(systems: SystemDeleteSnapshot[]): Promise<void> {
    if (systems.length === 0) return;

    const keys = new Set<string>();
    for (const system of systems) {
      keys.add(SystemCacheKeys.byId(system.id));
      keys.add(SystemCacheKeys.byName(system.name));
      keys.add(SystemCacheKeys.byPosition(system.position));
      keys.add(SystemCacheKeys.listByGalaxy(system.galaxyId));
    }

    try {
      await this.cache.delMany(Array.from(keys));
      await Promise.all([
        this.cache.delByPrefix(SystemCacheKeys.byNamePrefix()),
        this.cache.delByPrefix(SystemCacheKeys.byPositionPrefix()),
      ]);
    } catch {
      return;
    }
  }
}
