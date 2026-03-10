import { Dice } from "../../utils/Dice.class";
import { ErrorFactory } from "../../utils/errors/Error.map";
import { generateCelestialName } from "../../utils/nameGenerator";
import { REGEXP } from "../../utils/Regexp";
import { Uuid } from "./User";

const ALLOWED_PLANET_TYPES = ["solid", "gas"] as const;
const ALLOWED_PLANET_SIZES = ["proto", "dwarf", "medium", "giant", "supergiant"] as const;
export const PLANET_BIOMES_BY_TEMPERATURE = {
  cold: [
    "ice",
    "tundra",
    "glacial",
    "snow",
    "permafrost",
    "frozen_ocean",
    "ice_canyon",
    "cryo_volcanic",
    "polar_desert",
    "frost_crystal",
  ],
  temperate: [
    "gaia",
    "temperate",
    "continental",
    "ocean",
    "archipelago",
    "forest",
    "jungle",
    "savanna",
    "wetlands",
    "meadow",
  ],
  warm: [
    "desert",
    "arid",
    "dune",
    "volcanic",
    "lava",
    "toxic",
    "radioactive",
    "sulfuric",
    "crystal",
    "barren",
  ],
} as const;
export const ALLOWED_PLANET_BIOMES = [
  ...PLANET_BIOMES_BY_TEMPERATURE.cold,
  ...PLANET_BIOMES_BY_TEMPERATURE.temperate,
  ...PLANET_BIOMES_BY_TEMPERATURE.warm,
  "none",
] as const;

const EARTH_MASS = 5.9722e24 as const; // kg
const EARTH_RADIUS = 6.371e6 as const; // meters
const EARTH_GRAVITY = 9.80665 as const; // m/s^2

const PLANET_SIZE_MASS = {
  proto: [0.01, 0.2],
  dwarf: [0.1, 0.5],
  medium: [0.5, 2],
  giant: [5, 20],
  supergiant: [20, 100],
} as const;

const PLANET_SIZE_RADIUS = {
  proto: [0.2, 0.5],
  dwarf: [0.3, 0.7],
  medium: [0.7, 1.5],
  giant: [2, 5],
  supergiant: [5, 12],
} as const;

const BIOME_CATEGORY_TEMPERATURE_RANGE = {
  cold: [120, 240],
  temperate: [240, 320],
  warm: [280, 500],
  none: [50, 500],
} as const;

export type PlanetType = (typeof ALLOWED_PLANET_TYPES)[number];
export type PlanetSize = (typeof ALLOWED_PLANET_SIZES)[number];
export type PlanetBiome = (typeof ALLOWED_PLANET_BIOMES)[number];

export type PlanetProps = {
  id: Uuid;
  systemId: Uuid;
  name: PlanetName;
  type: PlanetType;
  size: PlanetSize;
  orbital: number;
  biome: PlanetBiome;
  relativeMass: number;
  absoluteMass: number;
  relativeRadius: number;
  absoluteRadius: number;
  gravity: number;
  temperature: number;
};

export type PlanetCreateProps = {
  id?: string;
  systemId: string;
  name?: string;
  type?: PlanetType;
  size?: PlanetSize;
  orbital: number;
  biome?: PlanetBiome;
  relativeMass?: number;
  relativeRadius?: number;
  temperature?: number;
};

export type PlanetDTO = {
  id: string;
  system_id: string;
  name: string;
  type: PlanetType;
  size: PlanetSize;
  orbital: number;
  biome: PlanetBiome;
  relative_mass: number;
  absolute_mass: number;
  relative_radius: number;
  absolute_radius: number;
  gravity: number;
  temperature: number;
};

export class PlanetName {
  private constructor(private readonly value: string) {}

  static create(value: string): PlanetName {
    const normalized = value.trim();
    if (!REGEXP.planetName.test(normalized)) {
      throw ErrorFactory.domain("DOMAIN.INVALID_PLANET_NAME", {
        name: value,
      });
    }

    return new PlanetName(normalized);
  }

  toString(): string {
    return this.value;
  }

  equals(other: PlanetName): boolean {
    return this.value === other.value;
  }
}

export class PlanetTypeValue {
  private constructor(private readonly value: PlanetType) {}

  static create(value: string): PlanetTypeValue {
    const valid = ALLOWED_PLANET_TYPES.includes(value as PlanetType);
    if (!valid) {
      throw ErrorFactory.domain("DOMAIN.INVALID_PLANET_TYPE", {
        type: value,
      });
    }
    return new PlanetTypeValue(value as PlanetType);
  }

  toString(): PlanetType {
    return this.value;
  }

  equals(other: PlanetTypeValue): boolean {
    return this.value === other.value;
  }
}

export class PlanetSizeValue {
  private constructor(private readonly value: PlanetSize) {}

  static create(value: string): PlanetSizeValue {
    const valid = ALLOWED_PLANET_SIZES.includes(value as PlanetSize);
    if (!valid) {
      throw ErrorFactory.domain("DOMAIN.INVALID_PLANET_SIZE", {
        size: value,
      });
    }
    return new PlanetSizeValue(value as PlanetSize);
  }

  toString(): PlanetSize {
    return this.value;
  }

  equals(other: PlanetSizeValue): boolean {
    return this.value === other.value;
  }
}

export class PlanetBiomeValue {
  private constructor(private readonly value: PlanetBiome) {}

  static create(value: string): PlanetBiomeValue {
    const valid = ALLOWED_PLANET_BIOMES.includes(value as PlanetBiome);
    if (!valid) {
      throw ErrorFactory.domain("DOMAIN.INVALID_PLANET_BIOME", {
        biome: value,
      });
    }
    return new PlanetBiomeValue(value as PlanetBiome);
  }

  toString(): PlanetBiome {
    return this.value;
  }

  equals(other: PlanetBiomeValue): boolean {
    return this.value === other.value;
  }
}

const randomBetween = (min: number, max: number): number => {
  if (min === max) return min;
  return min + Dice.roll(1) * (max - min);
};

const ensurePositive = (field: string, value: number): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw ErrorFactory.domain("DOMAIN.INVALID_PLANET_VALUE", { field });
  }
};

const ensureNonNegative = (field: string, value: number): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw ErrorFactory.domain("DOMAIN.INVALID_PLANET_VALUE", { field });
  }
};

const planetBiomeTemperatureCategory = (
  biome: PlanetBiome,
): keyof typeof BIOME_CATEGORY_TEMPERATURE_RANGE => {
  if (PLANET_BIOMES_BY_TEMPERATURE.cold.includes(biome as (typeof PLANET_BIOMES_BY_TEMPERATURE.cold)[number])) {
    return "cold";
  }

  if (
    PLANET_BIOMES_BY_TEMPERATURE.temperate.includes(
      biome as (typeof PLANET_BIOMES_BY_TEMPERATURE.temperate)[number],
    )
  ) {
    return "temperate";
  }

  if (PLANET_BIOMES_BY_TEMPERATURE.warm.includes(biome as (typeof PLANET_BIOMES_BY_TEMPERATURE.warm)[number])) {
    return "warm";
  }

  return "none";
};

export class Planet {
  private props: PlanetProps;

  private constructor(props: PlanetProps) {
    this.props = { ...props };
  }

  static create(input: PlanetCreateProps): Planet {
    const type = PlanetTypeValue.create(input.type ?? "solid");
    const size = PlanetSizeValue.create(input.size ?? "medium");
    const biome = PlanetBiomeValue.create(
      type.toString() === "gas" ? "none" : (input.biome ?? "temperate"),
    );

    ensurePositive("orbital", input.orbital);

    const massRange = PLANET_SIZE_MASS[size.toString()];
    const radiusRange = PLANET_SIZE_RADIUS[size.toString()];
    const temperatureRange =
      BIOME_CATEGORY_TEMPERATURE_RANGE[planetBiomeTemperatureCategory(biome.toString())];

    const relativeMass = input.relativeMass ?? randomBetween(massRange[0], massRange[1]);
    const relativeRadius = input.relativeRadius ?? randomBetween(radiusRange[0], radiusRange[1]);
    const temperature =
      input.temperature ?? randomBetween(temperatureRange[0], temperatureRange[1]);

    ensurePositive("relativeMass", relativeMass);
    ensurePositive("relativeRadius", relativeRadius);
    ensurePositive("temperature", temperature);

    const absoluteMass = relativeMass * EARTH_MASS;
    const absoluteRadius = relativeRadius * EARTH_RADIUS;
    const gravity = EARTH_GRAVITY * (relativeMass / (relativeRadius * relativeRadius));

    return new Planet({
      id: Uuid.create(input.id),
      systemId: Uuid.create(input.systemId),
      name: PlanetName.create(input.name ?? generateCelestialName()),
      type: type.toString(),
      size: size.toString(),
      orbital: input.orbital,
      biome: biome.toString(),
      relativeMass,
      absoluteMass,
      relativeRadius,
      absoluteRadius,
      gravity,
      temperature,
    });
  }

  static rehydrate(props: {
    id: string;
    systemId: string;
    name: string;
    type: PlanetType;
    size: PlanetSize;
    orbital: number;
    biome: PlanetBiome;
    relativeMass: number;
    absoluteMass: number;
    relativeRadius: number;
    absoluteRadius: number;
    gravity: number;
    temperature: number;
  }): Planet {
    ensurePositive("orbital", props.orbital);
    ensurePositive("relativeMass", props.relativeMass);
    ensurePositive("relativeRadius", props.relativeRadius);
    ensurePositive("temperature", props.temperature);
    ensureNonNegative("gravity", props.gravity);

    return new Planet({
      id: Uuid.create(props.id),
      systemId: Uuid.create(props.systemId),
      name: PlanetName.create(props.name),
      type: PlanetTypeValue.create(props.type).toString(),
      size: PlanetSizeValue.create(props.size).toString(),
      orbital: props.orbital,
      biome: PlanetBiomeValue.create(props.biome).toString(),
      relativeMass: props.relativeMass,
      absoluteMass: props.absoluteMass,
      relativeRadius: props.relativeRadius,
      absoluteRadius: props.absoluteRadius,
      gravity: props.gravity,
      temperature: props.temperature,
    });
  }

  get id(): string {
    return this.props.id.toString();
  }

  get systemId(): string {
    return this.props.systemId.toString();
  }

  get name(): string {
    return this.props.name.toString();
  }

  get type(): PlanetType {
    return this.props.type;
  }

  get size(): PlanetSize {
    return this.props.size;
  }

  get orbital(): number {
    return this.props.orbital;
  }

  get biome(): PlanetBiome {
    return this.props.biome;
  }

  get relativeMass(): number {
    return this.props.relativeMass;
  }

  get absoluteMass(): number {
    return this.props.absoluteMass;
  }

  get relativeRadius(): number {
    return this.props.relativeRadius;
  }

  get absoluteRadius(): number {
    return this.props.absoluteRadius;
  }

  get gravity(): number {
    return this.props.gravity;
  }

  get temperature(): number {
    return this.props.temperature;
  }

  rename(value: string): void {
    const next = PlanetName.create(value);
    if (next.equals(this.props.name)) {
      return;
    }
    this.props.name = next;
  }

  changeBiome(value: PlanetBiome): void {
    const next = PlanetBiomeValue.create(this.props.type === "gas" ? "none" : value);
    if (next.toString() === this.props.biome) {
      return;
    }
    this.props.biome = next.toString();
  }

  changeOrbital(value: number): void {
    ensurePositive("orbital", value);
    if (value === this.props.orbital) {
      return;
    }
    this.props.orbital = value;
  }

  toJSON(): {
    id: string;
    systemId: string;
    name: string;
    type: PlanetType;
    size: PlanetSize;
    orbital: number;
    biome: PlanetBiome;
    relativeMass: number;
    absoluteMass: number;
    relativeRadius: number;
    absoluteRadius: number;
    gravity: number;
    temperature: number;
  } {
    return {
      id: this.id,
      systemId: this.systemId,
      name: this.name,
      type: this.type,
      size: this.size,
      orbital: this.orbital,
      biome: this.biome,
      relativeMass: this.relativeMass,
      absoluteMass: this.absoluteMass,
      relativeRadius: this.relativeRadius,
      absoluteRadius: this.absoluteRadius,
      gravity: this.gravity,
      temperature: this.temperature,
    };
  }

  toDB(): PlanetDTO {
    return {
      id: this.id,
      system_id: this.systemId,
      name: this.name,
      type: this.type,
      size: this.size,
      orbital: this.orbital,
      biome: this.biome,
      relative_mass: this.relativeMass,
      absolute_mass: this.absoluteMass,
      relative_radius: this.relativeRadius,
      absolute_radius: this.absoluteRadius,
      gravity: this.gravity,
      temperature: this.temperature,
    };
  }
}
