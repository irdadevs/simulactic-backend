import { PopulateGalaxy } from "../../app/use-cases/queries/galaxies/PopulateGalaxy.query";
import { Uuid } from "../../domain/aggregates/User";

describe("PopulateGalaxy", () => {
  it("returns all systems and all nested children without truncation", async () => {
    const galaxyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const galaxy = { id: galaxyId, ownerId: "owner-1", name: "Alpha-01" } as any;

    const systems = Array.from({ length: 30 }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      galaxyId,
      name: `SYS-${i + 1}`,
    })) as any[];

    const starsBySystem = new Map<string, any[]>();
    const planetsBySystem = new Map<string, any[]>();
    const asteroidsBySystem = new Map<string, any[]>();
    const moonsByPlanet = new Map<string, any[]>();

    for (let i = 0; i < systems.length; i += 1) {
      const systemId = systems[i].id;
      const planetId = `11111111-1111-4111-8111-${String(i + 1).padStart(12, "0")}`;

      starsBySystem.set(systemId, [{ id: `star-${i + 1}`, systemId }]);
      planetsBySystem.set(systemId, [{ id: planetId, systemId }]);
      asteroidsBySystem.set(systemId, [{ id: `ast-${i + 1}`, systemId }]);
      moonsByPlanet.set(planetId, [{ id: `moon-${i + 1}`, planetId }]);
    }

    const galaxyRepo = {
      findById: jest.fn(async () => galaxy),
    } as any;
    const systemRepo = {
      findByGalaxy: jest.fn(async () => ({ rows: systems, total: systems.length })),
    } as any;
    const starRepo = {
      findBySystem: jest.fn(async (systemUuid: Uuid) => ({
        rows: starsBySystem.get(systemUuid.toString()) ?? [],
        total: (starsBySystem.get(systemUuid.toString()) ?? []).length,
      })),
    } as any;
    const planetRepo = {
      findBySystem: jest.fn(async (systemUuid: Uuid) => ({
        rows: planetsBySystem.get(systemUuid.toString()) ?? [],
        total: (planetsBySystem.get(systemUuid.toString()) ?? []).length,
      })),
    } as any;
    const moonRepo = {
      findByPlanet: jest.fn(async (planetUuid: Uuid) => ({
        rows: moonsByPlanet.get(planetUuid.toString()) ?? [],
        total: (moonsByPlanet.get(planetUuid.toString()) ?? []).length,
      })),
    } as any;
    const asteroidRepo = {
      findBySystem: jest.fn(async (systemUuid: Uuid) => ({
        rows: asteroidsBySystem.get(systemUuid.toString()) ?? [],
        total: (asteroidsBySystem.get(systemUuid.toString()) ?? []).length,
      })),
    } as any;
    const galaxyCache = {
      getPopulate: jest.fn(async (): Promise<null> => null),
      setPopulate: jest.fn(async (): Promise<void> => undefined),
    } as any;

    const query = new PopulateGalaxy(
      galaxyRepo,
      systemRepo,
      starRepo,
      planetRepo,
      moonRepo,
      asteroidRepo,
      galaxyCache,
    );

    const result = await query.execute(Uuid.create(galaxyId));

    expect(result.systems).toHaveLength(30);
    expect(result.systems.every((node) => node.stars.length === 1)).toBe(true);
    expect(result.systems.every((node) => node.planets.length === 1)).toBe(true);
    expect(result.systems.every((node) => node.asteroids.length === 1)).toBe(true);
    expect(result.systems.every((node) => node.planets[0].moons.length === 1)).toBe(true);
    expect(systemRepo.findByGalaxy).toHaveBeenCalledTimes(1);
    expect(galaxyCache.setPopulate).toHaveBeenCalledTimes(1);
  });
});
