import { Galaxy, GalaxyName, GalaxyShape } from "../../domain/aggregates/Galaxy";
import { Uuid } from "../../domain/aggregates/User";

export type ListGalaxyQuery = {
  search?: string; // name/shape/owner contains
  limit?: number; // pagination
  offset?: number;
  orderBy?: "createdAt" | "name" | "shape" | "owner";
  orderDir?: "asc" | "desc";
};

export type GalaxyAggregateCounts = {
  systems: number;
  stars: number;
  planets: number;
  moons: number;
  asteroids: number;
};

export type GlobalProceduralCounts = {
  galaxies: number;
  systems: number;
  stars: number;
  planets: number;
  moons: number;
  asteroids: number;
};

export interface IGalaxy {
  create(galaxy: Galaxy): Promise<Galaxy>;
  save(galaxy: Galaxy): Promise<Galaxy>;
  findById(id: Uuid): Promise<Galaxy | null>;
  findByOwner(ownerId: Uuid): Promise<Galaxy | null>;
  countByOwner(ownerId: Uuid): Promise<number>;
  findByName(name: GalaxyName): Promise<Galaxy | null>;
  findByShape(shape: GalaxyShape): Promise<Galaxy | null>;
  list(query: ListGalaxyQuery): Promise<{ rows: Galaxy[]; total: number }>;
  getAggregateCounts(galaxyId: Uuid): Promise<GalaxyAggregateCounts>;
  getGlobalProceduralCounts(): Promise<GlobalProceduralCounts>;
  changeName(id: Uuid, name: GalaxyName): Promise<Galaxy>;
  changeShape(id: Uuid, shape: GalaxyShape): Promise<Galaxy>;
  delete(id: Uuid): Promise<void>;
}
