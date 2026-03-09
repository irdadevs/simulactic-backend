import { Star } from "../../domain/aggregates/Star";

const validInput = {
  systemId: "11111111-1111-4111-8111-111111111111",
  name: "Sol",
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

describe("Star aggregate", () => {
  it("creates a star with defaults", () => {
    const star = Star.create(validInput);

    expect(star.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(star.systemId).toBe(validInput.systemId);
    expect(star.starClass).toBeDefined();
    expect(star.starType).toBeDefined();
    expect(star.surfaceTemperature).toBeGreaterThan(0);
    expect(star.relativeMass).toBeGreaterThan(0);
    expect(star.relativeRadius).toBeGreaterThan(0);
    expect(star.gravity).toBeGreaterThan(0);
  });

  it("throws on invalid star type", () => {
    assertDomainErrorCode(
      () =>
        Star.create({
          ...validInput,
          starType: "Purple dwarf" as "Red dwarf",
        }),
      "DOMAIN.INVALID_STAR_TYPE",
    );
  });

  it("throws on invalid star class", () => {
    assertDomainErrorCode(
      () =>
        Star.create({
          ...validInput,
          starClass: "Z" as "G",
        }),
      "DOMAIN.INVALID_STAR_CLASS",
    );
  });

  it("throws on invalid star color", () => {
    assertDomainErrorCode(
      () =>
        Star.create({
          ...validInput,
          color: "green" as "yellow",
        }),
      "DOMAIN.INVALID_STAR_COLOR",
    );
  });

  it("throws on invalid orbital", () => {
    assertDomainErrorCode(
      () =>
        Star.create({
          ...validInput,
          orbital: -1,
        }),
      "DOMAIN.INVALID_STAR_VALUE",
    );
  });

  it("creates a black hole with custom render radius", () => {
    const star = Star.create({
      ...validInput,
      starType: "Black hole",
      starClass: "BH",
      relativeMass: 10,
      relativeRadius: 0.5,
      name: "AST-010",
    });

    expect(star.starClass).toBe("BH");
    expect(star.relativeRadius).toBe(0.5);
  });

  it("creates a neutron star with custom render radius", () => {
    const star = Star.create({
      ...validInput,
      starType: "Neutron star",
      starClass: "N",
      relativeMass: 1.5,
      relativeRadius: 0.001,
      name: "AST-011",
    });

    expect(star.starClass).toBe("N");
    expect(star.relativeRadius).toBe(0.001);
  });

  it("rehydrates from persistence data", () => {
    const star = Star.rehydrate({
      id: "22222222-2222-4222-8222-222222222222",
      systemId: "33333333-3333-4333-8333-333333333333",
      name: "Helios",
      starType: "Yellow dwarf",
      starClass: "G",
      surfaceTemperature: 5800,
      color: "yellow",
      relativeMass: 1,
      absoluteMass: 1.98847e30,
      relativeRadius: 1,
      absoluteRadius: 6.9634e8,
      gravity: 274,
      isMain: true,
      orbital: 0,
      orbitalStarter: 0,
    });

    expect(star.id).toBe("22222222-2222-4222-8222-222222222222");
    expect(star.systemId).toBe("33333333-3333-4333-8333-333333333333");
    expect(star.name).toBe("Helios");
    expect(star.starClass).toBe("G");
  });

  it("maps to DB DTO", () => {
    const star = Star.create(validInput);

    const dto = star.toDB();

    expect(dto).toEqual({
      id: star.id,
      system_id: star.systemId,
      name: star.name,
      star_type: star.starType,
      star_class: star.starClass,
      surface_temperature: star.surfaceTemperature,
      color: star.color,
      relative_mass: star.relativeMass,
      absolute_mass: star.absoluteMass,
      relative_radius: star.relativeRadius,
      absolute_radius: star.absoluteRadius,
      gravity: star.gravity,
      is_main: star.isMain,
      orbital: star.orbital,
      orbital_starter: star.orbitalStarter,
    });
  });
});
