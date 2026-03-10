import { Planet } from "../../domain/aggregates/Planet";

const validInput = {
  systemId: "11111111-1111-4111-8111-111111111111",
  name: "Terra-1",
  orbital: 1,
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

describe("Planet aggregate", () => {
  it("creates a planet with defaults", () => {
    const planet = Planet.create(validInput);

    expect(planet.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(planet.systemId).toBe(validInput.systemId);
    expect(planet.name).toBe(validInput.name);
    expect(planet.orbital).toBe(validInput.orbital);
  });

  it("throws on invalid name", () => {
    assertDomainErrorCode(
      () =>
        Planet.create({
          ...validInput,
          name: "a",
        }),
      "DOMAIN.INVALID_PLANET_NAME",
    );
  });

  it("throws on invalid type", () => {
    assertDomainErrorCode(
      () =>
        Planet.create({
          ...validInput,
          type: "liquid" as "solid",
        }),
      "DOMAIN.INVALID_PLANET_TYPE",
    );
  });

  it("throws on invalid size", () => {
    assertDomainErrorCode(
      () =>
        Planet.create({
          ...validInput,
          size: "mega" as "medium",
        }),
      "DOMAIN.INVALID_PLANET_SIZE",
    );
  });

  it("throws on invalid biome", () => {
    assertDomainErrorCode(
      () =>
        Planet.create({
          ...validInput,
          biome: "invalid_biome" as "temperate",
        }),
      "DOMAIN.INVALID_PLANET_BIOME",
    );
  });

  it("throws on invalid orbital", () => {
    assertDomainErrorCode(
      () =>
        Planet.create({
          ...validInput,
          orbital: 0,
        }),
      "DOMAIN.INVALID_PLANET_VALUE",
    );
  });

  it("renames when different", () => {
    const planet = Planet.create(validInput);

    planet.rename("Nova-1");

    expect(planet.name).toBe("Nova-1");
  });

  it("changes biome when different", () => {
    const planet = Planet.create(validInput);

    planet.changeBiome("desert");

    expect(planet.biome).toBe("desert");
  });

  it('forces gas planets to use "none" biome', () => {
    const planet = Planet.create({
      ...validInput,
      type: "gas",
      biome: "desert",
    });

    expect(planet.biome).toBe("none");
  });

  it('keeps gas planets with "none" biome when changed', () => {
    const planet = Planet.create({
      ...validInput,
      type: "gas",
    });

    planet.changeBiome("forest");

    expect(planet.biome).toBe("none");
  });

  it("changes orbital when different", () => {
    const planet = Planet.create(validInput);

    planet.changeOrbital(2);

    expect(planet.orbital).toBe(2);
  });

  it("rehydrates from persistence data", () => {
    const planet = Planet.rehydrate({
      id: "22222222-2222-4222-8222-222222222222",
      systemId: "33333333-3333-4333-8333-333333333333",
      name: "Echo-1",
      type: "solid",
      size: "medium",
      orbital: 1,
      biome: "temperate",
      relativeMass: 1,
      absoluteMass: 5.9722e24,
      relativeRadius: 1,
      absoluteRadius: 6.371e6,
      gravity: 9.8,
      temperature: 288,
    });

    expect(planet.id).toBe("22222222-2222-4222-8222-222222222222");
    expect(planet.systemId).toBe("33333333-3333-4333-8333-333333333333");
    expect(planet.name).toBe("Echo-1");
  });

  it("maps to DB DTO", () => {
    const planet = Planet.create(validInput);

    const dto = planet.toDB();

    expect(dto).toEqual({
      id: planet.id,
      system_id: planet.systemId,
      name: planet.name,
      type: planet.type,
      size: planet.size,
      orbital: planet.orbital,
      biome: planet.biome,
      relative_mass: planet.relativeMass,
      absolute_mass: planet.absoluteMass,
      relative_radius: planet.relativeRadius,
      absolute_radius: planet.absoluteRadius,
      gravity: planet.gravity,
      temperature: planet.temperature,
    });
  });
});
