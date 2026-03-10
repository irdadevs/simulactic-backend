// @ts-nocheck
import { GalaxyLifecycleService } from "../../app/app-services/galaxies/GalaxyLifecycle.service";
import { CreateGalaxy } from "../../app/use-cases/commands/galaxies/CreateGalaxy.command";
import { Galaxy, GalaxyShapeValue } from "../../domain/aggregates/Galaxy";
import { User } from "../../domain/aggregates/User";

const validInput = {
  ownerId: "11111111-1111-4111-8111-111111111111",
  name: "Andromeda",
  systemCount: 3,
};

const assertDomainErrorCode = (fn: () => void, code: string) => {
  let thrown: unknown;
  try {
    fn();
  } catch (err) {
    thrown = err;
  }

  expect(thrown).toBeDefined();

  const error = thrown as { code?: string };
  expect(error.code).toBe(code);
};

describe("Galaxy aggregate", () => {
  it("creates a galaxy with defaults", () => {
    const galaxy = Galaxy.create(validInput);

    expect(galaxy.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(galaxy.ownerId).toBe(validInput.ownerId);
    expect(galaxy.name).toBe(validInput.name);
    expect(galaxy.systemCount).toBe(validInput.systemCount);
    expect(galaxy.createdAt).toBeInstanceOf(Date);
  });

  it("creates a galaxy with provided fields", () => {
    const galaxy = Galaxy.create({
      ...validInput,
      id: "22222222-2222-4222-8222-222222222222",
      shape: "spherical",
      createdAt: new Date("2025-03-03T00:00:00.000Z"),
    });

    expect(galaxy.id).toBe("22222222-2222-4222-8222-222222222222");
    expect(galaxy.shape).toBe("spherical");
    expect(galaxy.createdAt.toISOString()).toBe("2025-03-03T00:00:00.000Z");
  });

  it("throws on invalid owner id", () => {
    assertDomainErrorCode(
      () =>
        Galaxy.create({
          ...validInput,
          ownerId: "not-a-uuid",
        }),
      "DOMAIN.INVALID_USER_ID",
    );
  });

  it("throws on invalid name", () => {
    assertDomainErrorCode(
      () =>
        Galaxy.create({
          ...validInput,
          name: "bad",
        }),
      "DOMAIN.INVALID_GALAXY_NAME",
    );
  });

  it("throws on invalid shape", () => {
    assertDomainErrorCode(
      () =>
        Galaxy.create({
          ...validInput,
          shape: "circle",
        }),
      "DOMAIN.INVALID_GALAXY_SHAPE",
    );
  });

  it("normalizes system count minimum to 1", () => {
    const galaxy = Galaxy.create({
      ...validInput,
      systemCount: 0,
    });

    expect(galaxy.systemCount).toBe(1);
  });

  it("normalizes system count maximum to 1000", () => {
    const galaxy = Galaxy.create({
      ...validInput,
      systemCount: 1001,
    });

    expect(galaxy.systemCount).toBe(1000);
  });

  it("renames when different", () => {
    const galaxy = Galaxy.create(validInput);

    galaxy.rename("MilkyWay");

    expect(galaxy.name).toBe("MilkyWay");
  });

  it("keeps name when unchanged", () => {
    const galaxy = Galaxy.create(validInput);

    galaxy.rename(validInput.name);

    expect(galaxy.name).toBe(validInput.name);
  });

  it("changes shape when different", () => {
    const galaxy = Galaxy.create(validInput);
    const nextShape: GalaxyShapeValue = galaxy.shape === "irregular" ? "spherical" : "irregular";

    galaxy.changeShape(nextShape);

    expect(galaxy.shape).toBe(nextShape);
  });

  it("keeps shape when unchanged", () => {
    const galaxy = Galaxy.create(validInput);

    galaxy.changeShape(galaxy.shape);

    expect(galaxy.shape).toBe(galaxy.shape);
  });

  it("changes system count when different", () => {
    const galaxy = Galaxy.create(validInput);

    galaxy.changeSystemCount(10);

    expect(galaxy.systemCount).toBe(10);
  });

  it("normalizes system count on change", () => {
    const galaxy = Galaxy.create(validInput);

    galaxy.changeSystemCount(-5);

    expect(galaxy.systemCount).toBe(1);
  });

  it("normalizes system count maximum on change", () => {
    const galaxy = Galaxy.create(validInput);

    galaxy.changeSystemCount(1001);

    expect(galaxy.systemCount).toBe(1000);
  });

  it("rehydrates from persistence data", () => {
    const galaxy = Galaxy.rehydrate({
      id: "33333333-3333-4333-8333-333333333333",
      ownerId: "44444444-4444-4444-8444-444444444444",
      name: "Triangulum",
      shape: "5-arm spiral",
      systemCount: 12,
      createdAt: new Date("2024-02-02T00:00:00.000Z"),
    });

    expect(galaxy.id).toBe("33333333-3333-4333-8333-333333333333");
    expect(galaxy.ownerId).toBe("44444444-4444-4444-8444-444444444444");
    expect(galaxy.name).toBe("Triangulum");
    expect(galaxy.shape).toBe("5-arm spiral");
    expect(galaxy.systemCount).toBe(12);
  });

  it("maps to DB DTO", () => {
    const galaxy = Galaxy.create(validInput);

    const dto = galaxy.toDB();

    expect(dto).toEqual({
      id: galaxy.id,
      owner_id: galaxy.ownerId,
      name: galaxy.name,
      shape: galaxy.shape,
      system_count: galaxy.systemCount,
      created_at: galaxy.createdAt,
    });
  });
});

describe("CreateGalaxy command - supporter limit", () => {
  const makeDeps = (owner: User, ownerGalaxyCount: number) => {
    const uow = {
      db: {} as any,
      commit: jest.fn(async () => undefined),
      rollback: jest.fn(async () => undefined),
    };

    const galaxyRepo = {
      findByName: jest.fn(async () => null),
      countByOwner: jest.fn(async () => ownerGalaxyCount),
    };

    const userRepo = {
      findById: jest.fn(async () => owner),
    };

    const lifecycle = {
      createGalaxyTree: jest.fn(async (galaxy) => []),
    } as unknown as GalaxyLifecycleService;

    const command = new CreateGalaxy(
      {
        start: async () => uow,
      },
      {
        galaxy: () => galaxyRepo as any,
        system: () => ({}) as any,
        star: () => ({}) as any,
        planet: () => ({}) as any,
        moon: () => ({}) as any,
        asteroid: () => ({}) as any,
      },
      () => userRepo as any,
      lifecycle,
      {
        setGalaxy: jest.fn(async () => undefined),
        invalidateList: jest.fn(async () => undefined),
      } as any,
      {
        setSystem: jest.fn(async () => undefined),
        invalidateListByGalaxy: jest.fn(async () => undefined),
      } as any,
    );

    return {
      command,
      uow,
      galaxyRepo,
      lifecycle,
    };
  };

  it("rejects non-supporter non-admin owner with 3 galaxies", async () => {
    const owner = User.create({
      id: "11111111-1111-4111-8111-111111111111",
      email: "user@test.com",
      passwordHash: "hashed-password-123",
      username: "user_limit",
      role: "User",
      isSupporter: false,
    });

    const { command, uow, lifecycle } = makeDeps(owner, 3);

    await expect(
      command.execute({
        ownerId: owner.id,
        name: "OrionX",
        shape: "spherical",
        systemCount: 3,
      }),
    ).rejects.toMatchObject({ code: "PRESENTATION.INVALID_FIELD" });

    expect(lifecycle.createGalaxyTree).not.toHaveBeenCalled();
    expect(uow.commit).not.toHaveBeenCalled();
    expect(uow.rollback).toHaveBeenCalledTimes(1);
  });

  it("allows supporter owner with 3 galaxies", async () => {
    const owner = User.create({
      id: "22222222-2222-4222-8222-222222222222",
      email: "supporter@test.com",
      passwordHash: "hashed-password-123",
      username: "supporter_user",
      role: "User",
      isSupporter: true,
      supporterFrom: new Date("2026-02-20T00:00:00.000Z"),
    });

    const { command, uow, lifecycle } = makeDeps(owner, 3);

    await expect(
      command.execute({
        ownerId: owner.id,
        name: "Pegasus",
        shape: "spherical",
        systemCount: 3,
      }),
    ).resolves.toBeDefined();

    expect(lifecycle.createGalaxyTree).toHaveBeenCalledTimes(1);
    expect(uow.commit).toHaveBeenCalledTimes(1);
  });

  it("allows admin owner with 3 galaxies", async () => {
    const owner = User.create({
      id: "33333333-3333-4333-8333-333333333333",
      email: "admin@test.com",
      passwordHash: "hashed-password-123",
      username: "admin_user",
      role: "Admin",
      isSupporter: false,
    });

    const { command, uow, lifecycle } = makeDeps(owner, 3);

    await expect(
      command.execute({
        ownerId: owner.id,
        name: "HydraX",
        shape: "spherical",
        systemCount: 3,
      }),
    ).resolves.toBeDefined();

    expect(lifecycle.createGalaxyTree).toHaveBeenCalledTimes(1);
    expect(uow.commit).toHaveBeenCalledTimes(1);
  });

  it("normalizes system count upper bound before lifecycle creation", async () => {
    const owner = User.create({
      id: "44444444-4444-4444-8444-444444444444",
      email: "admin2@test.com",
      passwordHash: "hashed-password-123",
      username: "admin_user_2",
      role: "Admin",
      isSupporter: false,
    });

    const { command, lifecycle } = makeDeps(owner, 0);

    await expect(
      command.execute({
        ownerId: owner.id,
        name: "PhoenixX",
        shape: "spherical",
        systemCount: 1001,
      }),
    ).resolves.toBeDefined();

    expect(lifecycle.createGalaxyTree).toHaveBeenCalledTimes(1);
    const createdGalaxy = (lifecycle.createGalaxyTree as jest.Mock).mock.calls[0][0] as Galaxy;
    expect(createdGalaxy.systemCount).toBe(1000);
  });
});

describe("GalaxyLifecycleService - asteroid procedural generation", () => {
  it("applies random asteroid type and size during procedural creation", async () => {
    const service = new GalaxyLifecycleService();
    const galaxy = Galaxy.create({
      ownerId: "77777777-7777-4777-8777-777777777777",
      name: "Andromeda",
      shape: "spherical",
      systemCount: 1,
    });

    const asteroidSave = jest.fn(async () => undefined);
    const repos = {
      galaxy: { save: jest.fn(async () => undefined) },
      system: { save: jest.fn(async () => undefined) },
      star: { save: jest.fn(async () => undefined) },
      planet: { save: jest.fn(async () => undefined) },
      moon: { save: jest.fn(async () => undefined) },
      asteroid: { save: asteroidSave },
    } as any;

    jest.spyOn(service as any, "planetCountFromStarter").mockReturnValue(0);
    jest.spyOn(service as any, "asteroidCountFromStarter").mockReturnValue(2);
    jest.spyOn(service as any, "randomAsteroidType").mockReturnValue("cluster");
    jest.spyOn(service as any, "randomAsteroidSize").mockReturnValue("massive");

    await service.createGalaxyTree(galaxy, repos);

    expect(asteroidSave).toHaveBeenCalledTimes(2);
    for (const call of asteroidSave.mock.calls) {
      const asteroid = call[0];
      expect(asteroid.type).toBe("cluster");
      expect(asteroid.size).toBe("massive");
    }
  });
});

describe("GalaxyLifecycleService - planet and moon procedural generation", () => {
  it("applies random planet type, size and biome during procedural creation", async () => {
    const service = new GalaxyLifecycleService();
    const galaxy = Galaxy.create({
      ownerId: "88888888-8888-4888-8888-888888888888",
      name: "MilkyWayX",
      shape: "spherical",
      systemCount: 1,
    });

    const planetSave = jest.fn(async () => undefined);
    const repos = {
      galaxy: { save: jest.fn(async () => undefined) },
      system: { save: jest.fn(async () => undefined) },
      star: { save: jest.fn(async () => undefined) },
      planet: { save: planetSave },
      moon: { save: jest.fn(async () => undefined) },
      asteroid: { save: jest.fn(async () => undefined) },
    } as any;

    jest.spyOn(service as any, "planetCountFromStarter").mockReturnValue(1);
    jest.spyOn(service as any, "moonCountFromStarter").mockReturnValue(0);
    jest.spyOn(service as any, "asteroidCountFromStarter").mockReturnValue(0);
    jest.spyOn(service as any, "randomPlanetType").mockReturnValue("gas");
    jest.spyOn(service as any, "randomPlanetSize").mockReturnValue("supergiant");
    jest.spyOn(service as any, "randomPlanetBiome").mockReturnValue("none");

    await service.createGalaxyTree(galaxy, repos);

    expect(planetSave).toHaveBeenCalledTimes(1);
    const createdPlanet = planetSave.mock.calls[0][0];
    expect(createdPlanet.type).toBe("gas");
    expect(createdPlanet.size).toBe("supergiant");
    expect(createdPlanet.biome).toBe("none");
  });

  it("selects warm biomes for close solid planets", async () => {
    const service = new GalaxyLifecycleService();

    jest.spyOn(service as any, "randomInt").mockReturnValue(0);

    expect((service as any).randomPlanetBiome("solid", 1, 1)).toBe("desert");
  });

  it("selects cold biomes for far solid planets", async () => {
    const service = new GalaxyLifecycleService();

    jest.spyOn(service as any, "randomInt").mockReturnValue(0);

    expect((service as any).randomPlanetBiome("solid", 8, 1)).toBe("ice");
  });

  it("applies random moon size during procedural creation", async () => {
    const service = new GalaxyLifecycleService();
    const galaxy = Galaxy.create({
      ownerId: "99999999-9999-4999-8999-999999999999",
      name: "HydraY",
      shape: "spherical",
      systemCount: 1,
    });

    const moonSave = jest.fn(async () => undefined);
    const repos = {
      galaxy: { save: jest.fn(async () => undefined) },
      system: { save: jest.fn(async () => undefined) },
      star: { save: jest.fn(async () => undefined) },
      planet: { save: jest.fn(async () => undefined) },
      moon: { save: moonSave },
      asteroid: { save: jest.fn(async () => undefined) },
    } as any;

    jest.spyOn(service as any, "planetCountFromStarter").mockReturnValue(1);
    jest.spyOn(service as any, "moonCountFromStarter").mockReturnValue(1);
    jest.spyOn(service as any, "asteroidCountFromStarter").mockReturnValue(0);
    jest.spyOn(service as any, "randomPlanetType").mockReturnValue("solid");
    jest.spyOn(service as any, "randomPlanetSize").mockReturnValue("medium");
    jest.spyOn(service as any, "randomPlanetBiome").mockReturnValue("temperate");
    jest.spyOn(service as any, "randomMoonSize").mockReturnValue("giant");

    await service.createGalaxyTree(galaxy, repos);

    expect(moonSave).toHaveBeenCalledTimes(1);
    const createdMoon = moonSave.mock.calls[0][0];
    expect(createdMoon.size).toBe("giant");
  });
});
