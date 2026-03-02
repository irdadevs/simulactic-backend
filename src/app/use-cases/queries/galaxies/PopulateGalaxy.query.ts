import { Uuid } from "../../../../domain/aggregates/User";
import { ErrorFactory } from "../../../../utils/errors/Error.map";
import { GalaxyCacheService } from "../../../app-services/galaxies/GalaxyCache.service";
import { Asteroid } from "../../../../domain/aggregates/Asteroid";
import { Galaxy } from "../../../../domain/aggregates/Galaxy";
import { Moon } from "../../../../domain/aggregates/Moon";
import { Planet } from "../../../../domain/aggregates/Planet";
import { Star } from "../../../../domain/aggregates/Star";
import { System } from "../../../../domain/aggregates/System";
import { IAsteroid } from "../../../interfaces/Asteroid.port";
import { IGalaxy } from "../../../interfaces/Galaxy.port";
import { IMoon } from "../../../interfaces/Moon.port";
import { IPlanet } from "../../../interfaces/Planet.port";
import { IStar } from "../../../interfaces/Star.port";
import { ISystem } from "../../../interfaces/System.port";

export type PopulatedGalaxy = {
  galaxy: Galaxy;
  systems: Array<{
    system: System;
    stars: Star[];
    planets: Array<{
      planet: Planet;
      moons: Moon[];
    }>;
    asteroids: Asteroid[];
  }>;
};

export class PopulateGalaxy {
  constructor(
    private readonly galaxyRepo: IGalaxy,
    private readonly systemRepo: ISystem,
    private readonly starRepo: IStar,
    private readonly planetRepo: IPlanet,
    private readonly moonRepo: IMoon,
    private readonly asteroidRepo: IAsteroid,
    private readonly galaxyCache: GalaxyCacheService,
  ) {}

  async execute(galaxyId: Uuid): Promise<PopulatedGalaxy> {
    const cached = await this.galaxyCache.getPopulate(galaxyId.toString());
    if (cached) return cached;

    const galaxy = await this.galaxyRepo.findById(galaxyId);
    if (!galaxy) {
      throw ErrorFactory.presentation("SHARED.NOT_FOUND", {
        sourceType: "galaxy",
        id: galaxyId.toString(),
      });
    }

    const systemsResult = await this.systemRepo.findByGalaxy(galaxyId);

    const systems = await Promise.all(
      systemsResult.rows.map(async (system) => {
        const [starsResult, planetsResult, asteroidsResult] = await Promise.all([
          this.starRepo.findBySystem(Uuid.create(system.id)),
          this.planetRepo.findBySystem(Uuid.create(system.id)),
          this.asteroidRepo.findBySystem(Uuid.create(system.id)),
        ]);

        const planets = await Promise.all(
          planetsResult.rows.map(async (planet) => {
            const moonsResult = await this.moonRepo.findByPlanet(Uuid.create(planet.id));

            return {
              planet,
              moons: moonsResult.rows,
            };
          }),
        );

        return {
          system,
          stars: starsResult.rows,
          planets,
          asteroids: asteroidsResult.rows,
        };
      }),
    );

    const populated = {
      galaxy,
      systems,
    };
    await this.galaxyCache.setPopulate(galaxyId.toString(), populated);
    return populated;
  }
}
