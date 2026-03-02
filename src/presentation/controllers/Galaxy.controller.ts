import { Request, Response } from "express";
import { GalaxyName } from "../../domain/aggregates/Galaxy";
import { Uuid } from "../../domain/aggregates/User";
import { CreateGalaxy } from "../../app/use-cases/commands/galaxies/CreateGalaxy.command";
import { ChangeGalaxyName } from "../../app/use-cases/commands/galaxies/ChangeGalaxyName.command";
import { ChangeGalaxyShape } from "../../app/use-cases/commands/galaxies/ChangeGalaxyShape.command";
import { DeleteGalaxy } from "../../app/use-cases/commands/galaxies/DeleteGalaxy.command";
import { FindGalaxy } from "../../app/use-cases/queries/galaxies/FindGalaxy.query";
import { ListGalaxies } from "../../app/use-cases/queries/galaxies/ListGalaxies.query";
import { PopulateGalaxy } from "../../app/use-cases/queries/galaxies/PopulateGalaxy.query";
import { CreateGalaxyDTO } from "../security/galaxies/CreateGalaxy.dto";
import { FindGalaxyByIdDTO } from "../security/galaxies/FindGalaxyById.dto";
import { FindGalaxyByOwnerDTO } from "../security/galaxies/FindGalaxyByOwner.dto";
import { FindGalaxyByNameDTO } from "../security/galaxies/FindGalaxyByName.dto";
import { ListGalaxiesDTO } from "../security/galaxies/ListGalaxies.dto";
import { ChangeGalaxyNameDTO } from "../security/galaxies/ChangeGalaxyName.dto";
import { ChangeGalaxyShapeDTO } from "../security/galaxies/ChangeGalaxyShape.dto";
import errorHandler from "../../utils/errors/Errors.handler";
import invalidBody from "../../utils/invalidBody";
import {
  presentAsteroid,
  presentGalaxy,
  presentMoon,
  presentPlanet,
  presentStar,
  presentSystem,
} from "../presenters/Aggregate.presenter";

export class GalaxyController {
  constructor(
    private readonly createGalaxy: CreateGalaxy,
    private readonly changeGalaxyName: ChangeGalaxyName,
    private readonly changeGalaxyShape: ChangeGalaxyShape,
    private readonly deleteGalaxy: DeleteGalaxy,
    private readonly findGalaxy: FindGalaxy,
    private readonly listGalaxies: ListGalaxies,
    private readonly populateGalaxy: PopulateGalaxy,
  ) {}

  private isAdmin(req: Request): boolean {
    return req.auth.userRole === "Admin";
  }

  private async assertGalaxyAccess(
    req: Request,
    res: Response,
    galaxyId: string,
  ): Promise<boolean> {
    if (this.isAdmin(req)) {
      return true;
    }

    const galaxy = await this.findGalaxy.byId(Uuid.create(galaxyId));
    if (!galaxy) {
      return res.status(404).json({
        ok: false,
        error: "NOT_FOUND",
      }) as unknown as boolean;
    }

    if (galaxy.ownerId !== req.auth.userId) {
      return res.status(403).json({
        ok: false,
        error: "FORBIDDEN",
      }) as unknown as boolean;
    }

    return true;
  }

  public create = async (req: Request, res: Response) => {
    try {
      const parsed = CreateGalaxyDTO.safeParse(req.body);
      if (!parsed.success) {
        return invalidBody(res, parsed.error);
      }

      const galaxy = await this.createGalaxy.execute({
        ...parsed.data,
        ownerId: req.auth.userId,
      });
      return res.status(201).json(presentGalaxy(galaxy));
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public changeName = async (req: Request, res: Response) => {
    try {
      const parsedParams = FindGalaxyByIdDTO.safeParse(req.params);
      if (!parsedParams.success) {
        return invalidBody(res, parsedParams.error);
      }
      const canAccess = await this.assertGalaxyAccess(req, res, parsedParams.data.id);
      if (!canAccess) {
        return res;
      }

      const parsedBody = ChangeGalaxyNameDTO.safeParse(req.body);
      if (!parsedBody.success) {
        return invalidBody(res, parsedBody.error);
      }

      await this.changeGalaxyName.execute(Uuid.create(parsedParams.data.id), parsedBody.data);

      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public changeShape = async (req: Request, res: Response) => {
    try {
      const parsedParams = FindGalaxyByIdDTO.safeParse(req.params);
      if (!parsedParams.success) {
        return invalidBody(res, parsedParams.error);
      }
      const canAccess = await this.assertGalaxyAccess(req, res, parsedParams.data.id);
      if (!canAccess) {
        return res;
      }

      const parsedBody = ChangeGalaxyShapeDTO.safeParse(req.body);
      if (!parsedBody.success) {
        return invalidBody(res, parsedBody.error);
      }

      await this.changeGalaxyShape.execute(Uuid.create(parsedParams.data.id), parsedBody.data);

      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public delete = async (req: Request, res: Response) => {
    try {
      const parsed = FindGalaxyByIdDTO.safeParse(req.params);
      if (!parsed.success) {
        return invalidBody(res, parsed.error);
      }
      const canAccess = await this.assertGalaxyAccess(req, res, parsed.data.id);
      if (!canAccess) {
        return res;
      }

      await this.deleteGalaxy.execute(Uuid.create(parsed.data.id));
      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public list = async (req: Request, res: Response) => {
    try {
      if (this.isAdmin(req)) {
        const parsed = ListGalaxiesDTO.safeParse(req.query);
        if (!parsed.success) {
          return invalidBody(res, parsed.error);
        }

        const result = await this.listGalaxies.execute(parsed.data);
        return res.status(200).json({
          rows: result.rows.map((row) => presentGalaxy(row)),
          total: result.total,
        });
      }

      const galaxy = await this.findGalaxy.byOwner(Uuid.create(req.auth.userId));
      return res.status(200).json({
        rows: galaxy ? [presentGalaxy(galaxy)] : [],
        total: galaxy ? 1 : 0,
      });
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public findById = async (req: Request, res: Response) => {
    try {
      const parsed = FindGalaxyByIdDTO.safeParse(req.params);
      if (!parsed.success) {
        return invalidBody(res, parsed.error);
      }
      const canAccess = await this.assertGalaxyAccess(req, res, parsed.data.id);
      if (!canAccess) {
        return res;
      }

      const galaxy = await this.findGalaxy.byId(Uuid.create(parsed.data.id));
      return res.status(200).json(galaxy ? presentGalaxy(galaxy) : null);
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public findByOwner = async (req: Request, res: Response) => {
    try {
      const parsed = FindGalaxyByOwnerDTO.safeParse(req.params);
      if (!parsed.success) {
        return invalidBody(res, parsed.error);
      }
      if (!this.isAdmin(req) && parsed.data.ownerId !== req.auth.userId) {
        return res.status(403).json({
          ok: false,
          error: "FORBIDDEN",
        });
      }

      const galaxy = await this.findGalaxy.byOwner(Uuid.create(parsed.data.ownerId));
      return res.status(200).json(galaxy ? presentGalaxy(galaxy) : null);
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public findByName = async (req: Request, res: Response) => {
    try {
      const parsed = FindGalaxyByNameDTO.safeParse(req.params);
      if (!parsed.success) {
        return invalidBody(res, parsed.error);
      }

      const galaxy = await this.findGalaxy.byName(GalaxyName.create(parsed.data.name));
      if (galaxy && !this.isAdmin(req) && galaxy.ownerId !== req.auth.userId) {
        return res.status(403).json({
          ok: false,
          error: "FORBIDDEN",
        });
      }
      return res.status(200).json(galaxy ? presentGalaxy(galaxy) : null);
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public populate = async (req: Request, res: Response) => {
    try {
      const parsed = FindGalaxyByIdDTO.safeParse(req.params);
      if (!parsed.success) {
        return invalidBody(res, parsed.error);
      }
      const canAccess = await this.assertGalaxyAccess(req, res, parsed.data.id);
      if (!canAccess) {
        return res;
      }

      const galaxy = await this.populateGalaxy.execute(Uuid.create(parsed.data.id));
      return res.status(200).json({
        galaxy: presentGalaxy(galaxy.galaxy),
        systems: galaxy.systems.map((systemNode) => ({
          system: presentSystem(systemNode.system),
          stars: systemNode.stars.map((star) => presentStar(star)),
          planets: systemNode.planets.map((planetNode) => ({
            planet: presentPlanet(planetNode.planet),
            moons: planetNode.moons.map((moon) => presentMoon(moon)),
          })),
          asteroids: systemNode.asteroids.map((asteroid) => presentAsteroid(asteroid)),
        })),
      });
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };
}
