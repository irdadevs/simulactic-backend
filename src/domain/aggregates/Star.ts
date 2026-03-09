import { Dice } from "../../utils/Dice.class";
import { ErrorFactory } from "../../utils/errors/Error.map";
import { generateCelestialName } from "../../utils/nameGenerator";
import { REGEXP } from "../../utils/Regexp";
import { Uuid } from "./User";

const ALLOWED_STAR_TYPES = [
  "Blue supergiant",
  "Blue giant",
  "White dwarf",
  "Brown dwarf",
  "Yellow dwarf",
  "Subdwarf",
  "Red dwarf",
  "Black hole",
  "Neutron star",
] as const;
const ALLOWED_STAR_CLASS = ["O", "B", "A", "F", "G", "K", "M", "BH", "N"] as const;
const STAR_PROBABILITIES = [
  0.043, 0.05, 0.074, 0.06, 0.277, 0.3, 0.2445, 0.05333, 0.05117,
] as const;
const SUN_MASS = 1.98847e30 as const; // kg
const SUN_RADIUS = 6.9634e8 as const; // meters
const SUN_SURFACE_GRAVITY = 274 as const; // m/s^2
const GRAVITATIONAL_CONSTANT = 6.6743e-11 as const; // m^3 kg^-1 s^-2
const SPEED_OF_LIGHT = 299_792_458 as const; // m/s

const STAR_CLASS_COLOR = {
  O: "blue",
  B: "blue-white",
  A: "white",
  F: "yellow-white",
  G: "yellow",
  K: "orange",
  M: "red",
  BH: "black",
  N: "blue-white",
} as const;

const STAR_CLASS_TEMPERATURE = {
  O: [30000, 50000],
  B: [10000, 30000],
  A: [7500, 10000],
  F: [6000, 7500],
  G: [5200, 6000],
  K: [3700, 5200],
  M: [2400, 3700],
  // Hawking temperature for stellar-mass black holes (~3-100 M☉).
  BH: [6.17e-10, 2.06e-8],
  // Typical neutron-star surface temperatures (cool to young/hot remnants).
  N: [100000, 2000000],
} as const;

const STAR_CLASS_MASS = {
  O: [16, 60],
  B: [2.1, 16],
  A: [1.4, 2.1],
  F: [1.04, 1.4],
  G: [0.8, 1.04],
  K: [0.45, 0.8],
  M: [0.08, 0.45],
  BH: [3, 100],
  N: [1.1, 2.3],
} as const;

const STAR_CLASS_RADIUS = {
  O: [6, 15],
  B: [1.8, 6],
  A: [1.4, 2.5],
  F: [1.15, 1.4],
  G: [0.96, 1.15],
  K: [0.7, 0.96],
  M: [0.1, 0.7],
  // Physical Rs can be below neutron stars for low-mass BHs; use a render floor.
  BH: [0.0003, 30],
  N: [0.000144, 0.00201],
} as const;

export type StarType = (typeof ALLOWED_STAR_TYPES)[number];
export type StarClass = (typeof ALLOWED_STAR_CLASS)[number];
export type StarColor = (typeof STAR_CLASS_COLOR)[StarClass];

export type StarProps = {
  id: Uuid;
  systemId: Uuid;
  name: StarName;
  starType: StarType;
  starClass: StarClass;
  surfaceTemperature: number;
  color: StarColor;
  relativeMass: number;
  absoluteMass: number;
  relativeRadius: number;
  absoluteRadius: number;
  gravity: number;
  isMain: boolean;
  orbital: number;
  orbitalStarter: number;
};

export type StarCreateProps = {
  id?: string;
  systemId: string;
  name?: string;
  starType?: StarType;
  starClass?: StarClass;
  surfaceTemperature?: number;
  color?: StarColor;
  relativeMass?: number;
  relativeRadius?: number;
  isMain?: boolean;
  orbital?: number;
  orbitalStarter?: number;
};

export type StarDTO = {
  id: string;
  system_id: string;
  name: string;
  star_type: StarType;
  star_class: StarClass;
  surface_temperature: number;
  color: StarColor;
  relative_mass: number;
  absolute_mass: number;
  relative_radius: number;
  absolute_radius: number;
  gravity: number;
  is_main: boolean;
  orbital: number;
  orbital_starter: number;
};

export class StarTypeValue {
  private constructor(private readonly value: StarType) {}

  static create(value: string): StarTypeValue {
    const valid = ALLOWED_STAR_TYPES.includes(value as StarType);
    if (!valid) {
      throw ErrorFactory.domain("DOMAIN.INVALID_STAR_TYPE", {
        type: value,
      });
    }
    return new StarTypeValue(value as StarType);
  }

  toString(): StarType {
    return this.value;
  }

  equals(other: StarTypeValue): boolean {
    return this.value === other.value;
  }
}

export class StarClassValue {
  private constructor(private readonly value: StarClass) {}

  static create(value: string): StarClassValue {
    const valid = ALLOWED_STAR_CLASS.includes(value as StarClass);
    if (!valid) {
      throw ErrorFactory.domain("DOMAIN.INVALID_STAR_CLASS", {
        class: value,
      });
    }
    return new StarClassValue(value as StarClass);
  }

  toString(): StarClass {
    return this.value;
  }

  equals(other: StarClassValue): boolean {
    return this.value === other.value;
  }
}

export class StarColorValue {
  private constructor(private readonly value: StarColor) {}

  static create(value: string): StarColorValue {
    const valid = Object.values(STAR_CLASS_COLOR).includes(value as StarColor);
    if (!valid) {
      throw ErrorFactory.domain("DOMAIN.INVALID_STAR_COLOR", {
        color: value,
      });
    }
    return new StarColorValue(value as StarColor);
  }

  toString(): StarColor {
    return this.value;
  }

  equals(other: StarColorValue): boolean {
    return this.value === other.value;
  }
}

export class StarName {
  private constructor(private readonly value: string) {}

  static create(value: string): StarName {
    const normalized = value.trim();
    if (!REGEXP.planetName.test(normalized)) {
      throw ErrorFactory.domain("DOMAIN.INVALID_STAR_VALUE", {
        field: "name",
      });
    }
    return new StarName(normalized);
  }

  toString(): string {
    return this.value;
  }

  equals(other: StarName): boolean {
    return this.value === other.value;
  }
}

const STAR_TYPE_CLASS: Record<StarType, StarClass> = {
  "Blue supergiant": "O",
  "Blue giant": "B",
  "White dwarf": "A",
  "Brown dwarf": "M",
  "Yellow dwarf": "G",
  Subdwarf: "K",
  "Red dwarf": "M",
  "Black hole": "BH",
  "Neutron star": "N",
};

export const DEFAULT_STAR_TYPE_EXCLUSIONS: StarType[] = [];

export const sampleStarType = (excluded: StarType[] = []): StarType => {
  const excludedSet = new Set(excluded);
  const candidates = ALLOWED_STAR_TYPES.map((type, index) => ({
    type,
    probability: STAR_PROBABILITIES[index],
  })).filter((candidate) => !excludedSet.has(candidate.type));

  if (candidates.length === 0) {
    throw ErrorFactory.domain("DOMAIN.INVALID_STAR_TYPE", {
      type: "No star type candidates available",
    });
  }

  const total = candidates.reduce((sum, candidate) => sum + candidate.probability, 0);
  const roll = Dice.roll(total);
  let cursor = 0;
  for (const candidate of candidates) {
    cursor += candidate.probability;
    if (roll <= cursor) {
      return candidate.type;
    }
  }
  return candidates[candidates.length - 1].type;
};

const randomBetween = (min: number, max: number): number => {
  if (min === max) return min;
  return min + Dice.roll(1) * (max - min);
};

const schwarzschildRadius = (absoluteMass: number): number =>
  (2 * GRAVITATIONAL_CONSTANT * absoluteMass) / SPEED_OF_LIGHT ** 2;

const neutronStarRadius = (absoluteMass: number): number => {
  const massInSolar = absoluteMass / SUN_MASS;
  const baseKm = 12.5 - (massInSolar - 1.4) * 1.5;
  const clampedKm = Math.min(14, Math.max(10, baseKm));
  return clampedKm * 1000;
};

const blackHoleRadius = (absoluteMass: number): number => {
  const physicalRadius = schwarzschildRadius(absoluteMass);
  const minVisualRadius = STAR_CLASS_RADIUS.BH[0] * SUN_RADIUS;
  return Math.max(physicalRadius, minVisualRadius);
};

const resolveClassForType = (type: StarType): StarClass => STAR_TYPE_CLASS[type];

const resolveColorForClass = (starClass: StarClass): StarColor => STAR_CLASS_COLOR[starClass];

const ensurePositive = (field: string, value: number): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw ErrorFactory.domain("DOMAIN.INVALID_STAR_VALUE", { field });
  }
};

const ensureNonNegative = (field: string, value: number): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw ErrorFactory.domain("DOMAIN.INVALID_STAR_VALUE", { field });
  }
};

const ensureWithinRange = (field: string, value: number, min: number, max: number): void => {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw ErrorFactory.domain("DOMAIN.INVALID_STAR_VALUE", { field });
  }
};

export class Star {
  private props: StarProps;

  private constructor(props: StarProps) {
    this.props = { ...props };
  }

  static create(input: StarCreateProps): Star {
    const starType = StarTypeValue.create(
      input.starType ?? sampleStarType(DEFAULT_STAR_TYPE_EXCLUSIONS),
    );
    const resolvedClass = resolveClassForType(starType.toString());
    const starClass = input.starClass
      ? StarClassValue.create(input.starClass)
      : StarClassValue.create(resolvedClass);

    if (starClass.toString() !== resolvedClass) {
      throw ErrorFactory.domain("DOMAIN.INVALID_STAR_CLASS", {
        class: starClass.toString(),
      });
    }

    const color = input.color
      ? StarColorValue.create(input.color)
      : StarColorValue.create(resolveColorForClass(starClass.toString()));

    if (color.toString() !== resolveColorForClass(starClass.toString())) {
      throw ErrorFactory.domain("DOMAIN.INVALID_STAR_COLOR", {
        color: color.toString(),
      });
    }

    const massRange = STAR_CLASS_MASS[starClass.toString()];
    const temperatureRange = STAR_CLASS_TEMPERATURE[starClass.toString()];

    const relativeMass = input.relativeMass ?? randomBetween(massRange[0], massRange[1]);
    const surfaceTemperature =
      input.surfaceTemperature ?? randomBetween(temperatureRange[0], temperatureRange[1]);

    ensurePositive("relativeMass", relativeMass);
    ensurePositive("surfaceTemperature", surfaceTemperature);
    ensureWithinRange("relativeMass", relativeMass, massRange[0], massRange[1]);
    ensureWithinRange(
      "surfaceTemperature",
      surfaceTemperature,
      temperatureRange[0],
      temperatureRange[1],
    );

    const absoluteMass = relativeMass * SUN_MASS;
    const absoluteRadius =
      starClass.toString() === "BH"
        ? blackHoleRadius(absoluteMass)
        : starClass.toString() === "N"
          ? neutronStarRadius(absoluteMass)
          : (() => {
              const radiusRange = STAR_CLASS_RADIUS[starClass.toString()];
              const relativeRadius =
                input.relativeRadius ?? randomBetween(radiusRange[0], radiusRange[1]);
              ensurePositive("relativeRadius", relativeRadius);
              ensureWithinRange("relativeRadius", relativeRadius, radiusRange[0], radiusRange[1]);
              return relativeRadius * SUN_RADIUS;
            })();

    const relativeRadius = absoluteRadius / SUN_RADIUS;
    const gravity = SUN_SURFACE_GRAVITY * (relativeMass / (relativeRadius * relativeRadius));

    const orbital = input.orbital ?? 0;
    const orbitalStarter = input.orbitalStarter ?? 0;

    ensureNonNegative("orbital", orbital);
    ensureNonNegative("orbitalStarter", orbitalStarter);

    return new Star({
      id: Uuid.create(input.id),
      systemId: Uuid.create(input.systemId),
      name: StarName.create(input.name ?? generateCelestialName()),
      starType: starType.toString(),
      starClass: starClass.toString(),
      surfaceTemperature,
      color: color.toString(),
      relativeMass,
      absoluteMass,
      relativeRadius,
      absoluteRadius,
      gravity,
      isMain: input.isMain ?? true,
      orbital,
      orbitalStarter,
    });
  }

  static rehydrate(props: {
    id: string;
    systemId: string;
    name: string;
    starType: StarType;
    starClass: StarClass;
    surfaceTemperature: number;
    color: StarColor;
    relativeMass: number;
    absoluteMass: number;
    relativeRadius: number;
    absoluteRadius: number;
    gravity: number;
    isMain: boolean;
    orbital: number;
    orbitalStarter: number;
  }): Star {
    ensurePositive("relativeMass", props.relativeMass);
    ensurePositive("surfaceTemperature", props.surfaceTemperature);
    ensureNonNegative("orbital", props.orbital);
    ensureNonNegative("orbitalStarter", props.orbitalStarter);

    const starType = StarTypeValue.create(props.starType);
    const starClass = StarClassValue.create(props.starClass);
    const color = StarColorValue.create(props.color);

    const absoluteMass = props.relativeMass * SUN_MASS;
    const massRange = STAR_CLASS_MASS[starClass.toString()];
    const temperatureRange = STAR_CLASS_TEMPERATURE[starClass.toString()];
    ensureWithinRange("relativeMass", props.relativeMass, massRange[0], massRange[1]);
    ensureWithinRange(
      "surfaceTemperature",
      props.surfaceTemperature,
      temperatureRange[0],
      temperatureRange[1],
    );

    const absoluteRadius =
      starClass.toString() === "BH"
        ? blackHoleRadius(absoluteMass)
        : starClass.toString() === "N"
          ? neutronStarRadius(absoluteMass)
          : props.relativeRadius * SUN_RADIUS;
    const relativeRadius = absoluteRadius / SUN_RADIUS;

    if (starClass.toString() !== "BH" && starClass.toString() !== "N") {
      ensurePositive("relativeRadius", props.relativeRadius);
      const radiusRange = STAR_CLASS_RADIUS[starClass.toString()];
      ensureWithinRange("relativeRadius", props.relativeRadius, radiusRange[0], radiusRange[1]);
    } else {
      ensurePositive("relativeRadius", relativeRadius);
      const radiusRange = STAR_CLASS_RADIUS[starClass.toString()];
      ensureWithinRange("relativeRadius", relativeRadius, radiusRange[0], radiusRange[1]);
    }

    return new Star({
      id: Uuid.create(props.id),
      systemId: Uuid.create(props.systemId),
      name: StarName.create(props.name),
      starType: starType.toString(),
      starClass: starClass.toString(),
      surfaceTemperature: props.surfaceTemperature,
      color: color.toString(),
      relativeMass: props.relativeMass,
      absoluteMass,
      relativeRadius,
      absoluteRadius,
      gravity: SUN_SURFACE_GRAVITY * (props.relativeMass / (relativeRadius * relativeRadius)),
      isMain: props.isMain,
      orbital: props.orbital,
      orbitalStarter: props.orbitalStarter,
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

  get starType(): StarType {
    return this.props.starType;
  }

  get starClass(): StarClass {
    return this.props.starClass;
  }

  get surfaceTemperature(): number {
    return this.props.surfaceTemperature;
  }

  get color(): StarColor {
    return this.props.color;
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

  get isMain(): boolean {
    return this.props.isMain;
  }

  get orbital(): number {
    return this.props.orbital;
  }

  get orbitalStarter(): number {
    return this.props.orbitalStarter;
  }

  changeMainStatus(value: boolean): void {
    if (this.props.isMain === value) {
      return;
    }
    this.props.isMain = value;
  }

  rename(value: string): void {
    const next = StarName.create(value);
    if (next.equals(this.props.name)) {
      return;
    }
    this.props.name = next;
  }

  changeOrbital(value: number): void {
    ensureNonNegative("orbital", value);
    if (value === this.props.orbital) {
      return;
    }
    this.props.orbital = value;
  }

  changeOrbitalStarter(value: number): void {
    ensureNonNegative("orbitalStarter", value);
    if (value === this.props.orbitalStarter) {
      return;
    }
    this.props.orbitalStarter = value;
  }

  toJSON(): {
    id: string;
    systemId: string;
    name: string;
    starType: StarType;
    starClass: StarClass;
    surfaceTemperature: number;
    color: StarColor;
    relativeMass: number;
    absoluteMass: number;
    relativeRadius: number;
    absoluteRadius: number;
    gravity: number;
    isMain: boolean;
    orbital: number;
    orbitalStarter: number;
  } {
    return {
      id: this.id,
      systemId: this.systemId,
      name: this.name,
      starType: this.starType,
      starClass: this.starClass,
      surfaceTemperature: this.surfaceTemperature,
      color: this.color,
      relativeMass: this.relativeMass,
      absoluteMass: this.absoluteMass,
      relativeRadius: this.relativeRadius,
      absoluteRadius: this.absoluteRadius,
      gravity: this.gravity,
      isMain: this.isMain,
      orbital: this.orbital,
      orbitalStarter: this.orbitalStarter,
    };
  }

  toDB(): StarDTO {
    return {
      id: this.id,
      system_id: this.systemId,
      name: this.name,
      star_type: this.starType,
      star_class: this.starClass,
      surface_temperature: this.surfaceTemperature,
      color: this.color,
      relative_mass: this.relativeMass,
      absolute_mass: this.absoluteMass,
      relative_radius: this.relativeRadius,
      absolute_radius: this.absoluteRadius,
      gravity: this.gravity,
      is_main: this.isMain,
      orbital: this.orbital,
      orbital_starter: this.orbitalStarter,
    };
  }
}
