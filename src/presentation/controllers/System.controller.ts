import { Request, Response } from "express";
import { SystemName } from "../../domain/aggregates/System";
import { Uuid } from "../../domain/aggregates/User";
import { ChangeSystemName } from "../../app/use-cases/commands/systems/ChangeSystemName.command";
import { ChangeSystemPosition } from "../../app/use-cases/commands/systems/ChangeSystemPosition.command";
import { FindSystem } from "../../app/use-cases/queries/systems/FindSystem.query";
import { ListSystemsByGalaxy } from "../../app/use-cases/queries/systems/ListSystemsByGalaxy.query";
import { FindGalaxy } from "../../app/use-cases/queries/galaxies/FindGalaxy.query";
import { FindSystemByIdDTO } from "../security/systems/FindSystemById.dto";
import { FindSystemByNameDTO } from "../security/systems/FindSystemByName.dto";
import { FindSystemByPositionDTO } from "../security/systems/FindSystemByPosition.dto";
import { FindSystemsByGalaxyDTO } from "../security/systems/FindSystemsByGalaxy.dto";
import { ChangeSystemNameDTO } from "../security/systems/ChangeSystemName.dto";
import { ChangeSystemPositionDTO } from "../security/systems/ChangeSystemPosition.dto";
import errorHandler from "../../utils/errors/Errors.handler";
import invalidBody from "../../utils/invalidBody";
import { presentSystem } from "../presenters/Aggregate.presenter";

export class SystemController {
  constructor(
    private readonly findSystem: FindSystem,
    private readonly listSystemsByGalaxy: ListSystemsByGalaxy,
    private readonly changeSystemName: ChangeSystemName,
    private readonly changeSystemPosition: ChangeSystemPosition,
    private readonly findGalaxy: FindGalaxy,
  ) {}

  private isAdmin(req: Request): boolean {
    return req.auth.userRole === "Admin";
  }

  private async canAccessGalaxy(req: Request, galaxyId: string): Promise<boolean> {
    if (this.isAdmin(req)) return true;
    const galaxy = await this.findGalaxy.byId(Uuid.create(galaxyId));
    return Boolean(galaxy && galaxy.ownerId === req.auth.userId);
  }

  private async canAccessSystem(req: Request, systemId: string): Promise<boolean> {
    if (this.isAdmin(req)) return true;
    const system = await this.findSystem.byId(Uuid.create(systemId));
    if (!system) return false;
    return this.canAccessGalaxy(req, system.galaxyId);
  }

  public listByGalaxy = async (req: Request, res: Response) => {
    try {
      const parsed = FindSystemsByGalaxyDTO.safeParse(req.params);
      if (!parsed.success) {
        return invalidBody(res, parsed.error);
      }

      const canAccess = await this.canAccessGalaxy(req, parsed.data.galaxyId);
      if (!canAccess) {
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }

      const result = await this.listSystemsByGalaxy.execute(Uuid.create(parsed.data.galaxyId));
      return res.status(200).json({
        rows: result.rows.map((row) => presentSystem(row)),
        total: result.total,
      });
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public findById = async (req: Request, res: Response) => {
    try {
      const parsed = FindSystemByIdDTO.safeParse(req.params);
      if (!parsed.success) {
        return invalidBody(res, parsed.error);
      }

      const canAccess = await this.canAccessSystem(req, parsed.data.id);
      if (!canAccess) {
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }

      const system = await this.findSystem.byId(Uuid.create(parsed.data.id));
      return res.status(200).json(system ? presentSystem(system) : null);
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public findByName = async (req: Request, res: Response) => {
    try {
      const parsed = FindSystemByNameDTO.safeParse(req.params);
      if (!parsed.success) {
        return invalidBody(res, parsed.error);
      }

      const system = await this.findSystem.byName(SystemName.create(parsed.data.name));
      if (system) {
        const canAccess = await this.canAccessGalaxy(req, system.galaxyId);
        if (!canAccess) {
          return res.status(403).json({ ok: false, error: "FORBIDDEN" });
        }
      }

      return res.status(200).json(system ? presentSystem(system) : null);
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public findByPosition = async (req: Request, res: Response) => {
    try {
      const parsed = FindSystemByPositionDTO.safeParse(req.query);
      if (!parsed.success) {
        return invalidBody(res, parsed.error);
      }

      const system = await this.findSystem.byPosition(parsed.data);
      if (system) {
        const canAccess = await this.canAccessGalaxy(req, system.galaxyId);
        if (!canAccess) {
          return res.status(403).json({ ok: false, error: "FORBIDDEN" });
        }
      }

      return res.status(200).json(system ? presentSystem(system) : null);
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public changeName = async (req: Request, res: Response) => {
    try {
      const parsedParams = FindSystemByIdDTO.safeParse(req.params);
      if (!parsedParams.success) {
        return invalidBody(res, parsedParams.error);
      }
      const parsedBody = ChangeSystemNameDTO.safeParse(req.body);
      if (!parsedBody.success) {
        return invalidBody(res, parsedBody.error);
      }

      const canAccess = await this.canAccessSystem(req, parsedParams.data.id);
      if (!canAccess) {
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }

      await this.changeSystemName.execute(Uuid.create(parsedParams.data.id), parsedBody.data);
      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public changePosition = async (req: Request, res: Response) => {
    try {
      const parsedParams = FindSystemByIdDTO.safeParse(req.params);
      if (!parsedParams.success) {
        return invalidBody(res, parsedParams.error);
      }
      const parsedBody = ChangeSystemPositionDTO.safeParse(req.body);
      if (!parsedBody.success) {
        return invalidBody(res, parsedBody.error);
      }

      const canAccess = await this.canAccessSystem(req, parsedParams.data.id);
      if (!canAccess) {
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }

      await this.changeSystemPosition.execute(Uuid.create(parsedParams.data.id), parsedBody.data);
      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };
}
