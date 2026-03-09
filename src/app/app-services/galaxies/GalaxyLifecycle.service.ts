import { Queryable } from "../../../config/db/Queryable";
import {
  Asteroid,
  AsteroidSize,
  AsteroidType,
} from "../../../domain/aggregates/Asteroid";
import { Galaxy, GalaxyShapeValue } from "../../../domain/aggregates/Galaxy";
import { Moon, MoonSize } from "../../../domain/aggregates/Moon";
import {
  Planet,
  PlanetBiome,
  PlanetSize,
  PlanetType,
} from "../../../domain/aggregates/Planet";
import { Star, StarType, sampleStarType } from "../../../domain/aggregates/Star";
import { System } from "../../../domain/aggregates/System";
import { Uuid } from "../../../domain/aggregates/User";
import { Dice } from "../../../utils/Dice.class";
import { generateCelestialName } from "../../../utils/nameGenerator";
import { IAsteroid } from "../../interfaces/Asteroid.port";
import { IGalaxy } from "../../interfaces/Galaxy.port";
import { IMoon } from "../../interfaces/Moon.port";
import { IPlanet } from "../../interfaces/Planet.port";
import { IStar } from "../../interfaces/Star.port";
import { ISystem } from "../../interfaces/System.port";

export type ProceduralRepoFactories = {
  galaxy: (db: Queryable) => IGalaxy;
  system: (db: Queryable) => ISystem;
  star: (db: Queryable) => IStar;
  planet: (db: Queryable) => IPlanet;
  moon: (db: Queryable) => IMoon;
  asteroid: (db: Queryable) => IAsteroid;
};

export type ProceduralRepos = {
  galaxy: IGalaxy;
  system: ISystem;
  star: IStar;
  planet: IPlanet;
  moon: IMoon;
  asteroid: IAsteroid;
};

const COMPANION_STAR_EXCLUSIONS: StarType[] = ["Black hole", "Neutron star"];

const ORBITAL_STARTER_BY_STAR_TYPE: Record<StarType, number> = {
  "Blue supergiant": 4,
  "Blue giant": 3,
  "White dwarf": 2,
  "Brown dwarf": 1,
  "Yellow dwarf": 1,
  Subdwarf: 2,
  "Red dwarf": 1,
  "Black hole": 5,
  "Neutron star": 4,
};

const PROCEDURAL_ASTEROID_TYPES: AsteroidType[] = ["single", "cluster"];
const PROCEDURAL_ASTEROID_SIZES: AsteroidSize[] = ["small", "medium", "big", "massive"];
const PROCEDURAL_PLANET_TYPES: PlanetType[] = ["solid", "gas"];
const PROCEDURAL_PLANET_SIZES: PlanetSize[] = ["proto", "dwarf", "medium", "giant", "supergiant"];
const PROCEDURAL_PLANET_BIOMES: PlanetBiome[] = [
  "temperate",
  "desert",
  "ocean",
  "ice",
  "toxic",
  "radioactive",
  "crystal",
];
const PROCEDURAL_MOON_SIZES: MoonSize[] = ["dwarf", "medium", "giant"];

export class GalaxyLifecycleService {
  private randomInt(min: number, max: number): number {
    if (max <= min) return min;
    return min + Dice.roll(max - min + 1, true);
  }

  private randomSystemPosition(
    shape: GalaxyShapeValue,
    systemIdx: number,
    totalSystems: number,
  ) {
    const radius = 4000 + systemIdx * 6 + Dice.roll(200);
    const theta = (2 * Math.PI * systemIdx) / Math.max(1, totalSystems);
    const jitter = () => Dice.roll(180) - 90;
    const zJitter = () => Dice.roll(1200) - 600;

    if (shape === "spherical") {
      const phi = Math.acos(2 * Math.random() - 1);
      const rr = radius + Dice.roll(500);
      return {
        x: rr * Math.sin(phi) * Math.cos(theta),
        y: rr * Math.sin(phi) * Math.sin(theta),
        z: rr * Math.cos(phi),
      };
    }

    if (shape === "irregular") {
      return {
        x: (Dice.roll(1) - 0.5) * 10_000,
        y: (Dice.roll(1) - 0.5) * 10_000,
        z: zJitter(),
      };
    }

    const armCount = shape === "3-arm spiral" ? 3 : 5;
    const arm = systemIdx % armCount;
    const armOffset = ((2 * Math.PI) / armCount) * arm;
    const spin = radius / 2200;
    const angle = theta + armOffset + spin;
    return {
      x: Math.cos(angle) * radius + jitter(),
      y: Math.sin(angle) * radius + jitter(),
      z: zJitter(),
    };
  }

  private createStarForSystem(systemId: string, starType?: StarType): Star {
    const initial = Star.create({
      systemId,
      starType,
      orbital: 0,
      orbitalStarter: 0,
      isMain: false,
    });
    const starter = ORBITAL_STARTER_BY_STAR_TYPE[initial.starType];
    return Star.create({
      systemId,
      starType: initial.starType,
      starClass: initial.starClass,
      color: initial.color,
      surfaceTemperature: initial.surfaceTemperature,
      relativeMass: initial.relativeMass,
      relativeRadius: initial.relativeRadius,
      orbital: 0,
      orbitalStarter: starter,
      isMain: false,
    });
  }

  private generateSystemStars(systemId: string): Star[] {
    const first = this.createStarForSystem(systemId);

    if (first.starType === "Black hole" || first.starType === "Neutron star") {
      first.changeMainStatus(true);
      return [first];
    }

    const total = this.randomInt(1, 3);
    const stars: Star[] = [first];

    for (let i = 1; i < total; i += 1) {
      stars.push(
        this.createStarForSystem(
          systemId,
          sampleStarType(COMPANION_STAR_EXCLUSIONS),
        ),
      );
    }

    stars.sort((a, b) => b.relativeMass - a.relativeMass);

    stars.forEach((star, idx) => {
      star.changeMainStatus(idx === 0);
      star.changeOrbital(idx === 0 ? 0 : 1);
    });

    return stars;
  }

  private planetCountFromStarter(starter: number): number {
    const maxPlanets = Math.max(0, 9 - starter);
    return this.randomInt(0, maxPlanets);
  }

  private asteroidCountFromStarter(starter: number): number {
    const maxAsteroids = Math.max(0, 9 - starter);
    return this.randomInt(0, maxAsteroids);
  }

  private moonCountFromStarter(starter: number): number {
    const maxMoons = Math.max(0, Math.min(5, 6 - starter));
    return this.randomInt(0, maxMoons);
  }

  private randomAsteroidType(): AsteroidType {
    const idx = this.randomInt(0, PROCEDURAL_ASTEROID_TYPES.length - 1);
    return PROCEDURAL_ASTEROID_TYPES[idx];
  }

  private randomAsteroidSize(): AsteroidSize {
    const idx = this.randomInt(0, PROCEDURAL_ASTEROID_SIZES.length - 1);
    return PROCEDURAL_ASTEROID_SIZES[idx];
  }

  private randomPlanetType(): PlanetType {
    const idx = this.randomInt(0, PROCEDURAL_PLANET_TYPES.length - 1);
    return PROCEDURAL_PLANET_TYPES[idx];
  }

  private randomPlanetSize(): PlanetSize {
    const idx = this.randomInt(0, PROCEDURAL_PLANET_SIZES.length - 1);
    return PROCEDURAL_PLANET_SIZES[idx];
  }

  private randomPlanetBiome(): PlanetBiome {
    const idx = this.randomInt(0, PROCEDURAL_PLANET_BIOMES.length - 1);
    return PROCEDURAL_PLANET_BIOMES[idx];
  }

  private randomMoonSize(): MoonSize {
    const idx = this.randomInt(0, PROCEDURAL_MOON_SIZES.length - 1);
    return PROCEDURAL_MOON_SIZES[idx];
  }

  async createGalaxyTree(
    galaxy: Galaxy,
    repos: ProceduralRepos,
  ): Promise<System[]> {
    const createdSystems: System[] = [];
    await repos.galaxy.save(galaxy);

    for (let i = 0; i < galaxy.systemCount; i += 1) {
      const system = System.create({
        galaxyId: galaxy.id,
        name: generateCelestialName(),
        position: this.randomSystemPosition(
          galaxy.shape,
          i,
          galaxy.systemCount,
        ),
      });
      await repos.system.save(system);
      createdSystems.push(system);

      const stars = this.generateSystemStars(system.id);
      for (const star of stars) {
        await repos.star.save(star);
      }

      const mainStar = stars.find((s) => s.isMain) ?? stars[0];
      const starter = Math.max(
        1,
        Math.min(8, Math.round(mainStar.orbitalStarter)),
      );
      const planetCount = this.planetCountFromStarter(starter);

      for (let p = 0; p < planetCount; p += 1) {
        const orbital = starter + p;
        if (orbital > 8) break;

        const planet = Planet.create({
          systemId: system.id,
          type: this.randomPlanetType(),
          size: this.randomPlanetSize(),
          biome: this.randomPlanetBiome(),
          orbital,
        });
        await repos.planet.save(planet);

        const moonCount = this.moonCountFromStarter(starter);
        for (let m = 1; m <= moonCount; m += 1) {
          if (m > 5) break;
          const moon = Moon.create({
            planetId: planet.id,
            size: this.randomMoonSize(),
            orbital: m,
          });
          await repos.moon.save(moon);
        }
      }

      const asteroidCount = this.asteroidCountFromStarter(starter);
      for (let a = 0; a < asteroidCount; a += 1) {
        const orbital = starter + 0.5 + a;
        if (orbital > 8.5) break;
        const asteroid = Asteroid.create({
          systemId: system.id,
          type: this.randomAsteroidType(),
          size: this.randomAsteroidSize(),
          orbital,
        });
        await repos.asteroid.save(asteroid);
      }
    }

    return createdSystems;
  }

  async recalculateSystemPositionsForShape(
    galaxy: Galaxy,
    systemRepo: ISystem,
  ): Promise<System[]> {
    const systems = await systemRepo.findByGalaxy(Uuid.create(galaxy.id));
    const updated: System[] = [];

    for (let i = 0; i < systems.rows.length; i += 1) {
      const system = systems.rows[i];
      system.move(this.randomSystemPosition(galaxy.shape, i, systems.rows.length));
      await systemRepo.save(system);
      updated.push(system);
    }

    return updated;
  }

  async deleteGalaxyTree(
    galaxyId: Uuid,
    repos: ProceduralRepos,
  ): Promise<System[]> {
    const systems = await repos.system.findByGalaxy(galaxyId);

    for (const system of systems.rows) {
      const [planets, asteroids, stars] = await Promise.all([
        repos.planet.findBySystem(Uuid.create(system.id)),
        repos.asteroid.findBySystem(Uuid.create(system.id)),
        repos.star.findBySystem(Uuid.create(system.id)),
      ]);

      for (const planet of planets.rows) {
        const moons = await repos.moon.findByPlanet(Uuid.create(planet.id));
        for (const moon of moons.rows) {
          await repos.moon.delete(Uuid.create(moon.id));
        }
        await repos.planet.delete(Uuid.create(planet.id));
      }

      for (const asteroid of asteroids.rows) {
        await repos.asteroid.delete(Uuid.create(asteroid.id));
      }

      for (const star of stars.rows) {
        await repos.star.delete(Uuid.create(star.id));
      }

      await repos.system.delete(Uuid.create(system.id));
    }

    await repos.galaxy.delete(galaxyId);
    return systems.rows;
  }
}
