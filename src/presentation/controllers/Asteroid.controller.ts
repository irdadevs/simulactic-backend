import { Request, Response } from "express";
import { AsteroidName } from "../../domain/aggregates/Asteroid";
import { Uuid } from "../../domain/aggregates/User";
import { ChangeAsteroidName } from "../../app/use-cases/commands/asteroids/ChangeAsteroidName.command";
import { ChangeAsteroidType } from "../../app/use-cases/commands/asteroids/ChangeAsteroidType.command";
import { ChangeAsteroidSize } from "../../app/use-cases/commands/asteroids/ChangeAsteroidSize.command";
import { ChangeAsteroidOrbital } from "../../app/use-cases/commands/asteroids/ChangeAsteroidOrbital.command";
import { FindAsteroid } from "../../app/use-cases/queries/asteroids/FindAsteroid.query";
import { ListAsteroidsBySystem } from "../../app/use-cases/queries/asteroids/ListAsteroidsBySystem.query";
import { FindSystem } from "../../app/use-cases/queries/systems/FindSystem.query";
import { FindGalaxy } from "../../app/use-cases/queries/galaxies/FindGalaxy.query";
import { FindAsteroidByIdDTO } from "../security/asteroids/FindAsteroidById.dto";
import { FindAsteroidsBySystemDTO } from "../security/asteroids/FindAsteroidsBySystem.dto";
import { FindAsteroidByNameDTO } from "../security/asteroids/FindAsteroidByName.dto";
import { ChangeAsteroidNameDTO } from "../security/asteroids/ChangeAsteroidName.dto";
import { ChangeAsteroidTypeDTO } from "../security/asteroids/ChangeAsteroidType.dto";
import { ChangeAsteroidSizeDTO } from "../security/asteroids/ChangeAsteroidSize.dto";
import { ChangeAsteroidOrbitalDTO } from "../security/asteroids/ChangeAsteroidOrbital.dto";
import errorHandler from "../../utils/errors/Errors.handler";
import invalidBody from "../../utils/invalidBody";
import { presentAsteroid } from "../presenters/Aggregate.presenter";

export class AsteroidController {
  constructor(
    private readonly findAsteroid: FindAsteroid,
    private readonly listAsteroidsBySystem: ListAsteroidsBySystem,
    private readonly changeAsteroidName: ChangeAsteroidName,
    private readonly changeAsteroidType: ChangeAsteroidType,
    private readonly changeAsteroidSize: ChangeAsteroidSize,
    private readonly changeAsteroidOrbital: ChangeAsteroidOrbital,
    private readonly findSystem: FindSystem,
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

  private async canAccessAsteroid(req: Request, asteroidId: string): Promise<boolean> {
    if (this.isAdmin(req)) return true;
    const asteroid = await this.findAsteroid.byId(Uuid.create(asteroidId));
    if (!asteroid) return false;
    return this.canAccessSystem(req, asteroid.systemId);
  }

  public listBySystem = async (req: Request, res: Response) => {
    try {
      const parsed = FindAsteroidsBySystemDTO.safeParse(req.params);
      if (!parsed.success) return invalidBody(res, parsed.error);
      const canAccess = await this.canAccessSystem(req, parsed.data.systemId);
      if (!canAccess) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      const result = await this.listAsteroidsBySystem.execute(Uuid.create(parsed.data.systemId));
      return res.status(200).json({
        rows: result.rows.map((row) => presentAsteroid(row)),
        total: result.total,
      });
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public findById = async (req: Request, res: Response) => {
    try {
      const parsed = FindAsteroidByIdDTO.safeParse(req.params);
      if (!parsed.success) return invalidBody(res, parsed.error);
      const canAccess = await this.canAccessAsteroid(req, parsed.data.id);
      if (!canAccess) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      const asteroid = await this.findAsteroid.byId(Uuid.create(parsed.data.id));
      return res.status(200).json(asteroid ? presentAsteroid(asteroid) : null);
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public findByName = async (req: Request, res: Response) => {
    try {
      const parsed = FindAsteroidByNameDTO.safeParse(req.params);
      if (!parsed.success) return invalidBody(res, parsed.error);
      const asteroid = await this.findAsteroid.byName(AsteroidName.create(parsed.data.name));
      if (asteroid) {
        const canAccess = await this.canAccessSystem(req, asteroid.systemId);
        if (!canAccess) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }
      return res.status(200).json(asteroid ? presentAsteroid(asteroid) : null);
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public changeName = async (req: Request, res: Response) => {
    try {
      const p = FindAsteroidByIdDTO.safeParse(req.params);
      if (!p.success) return invalidBody(res, p.error);
      const b = ChangeAsteroidNameDTO.safeParse(req.body);
      if (!b.success) return invalidBody(res, b.error);
      const canAccess = await this.canAccessAsteroid(req, p.data.id);
      if (!canAccess) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      await this.changeAsteroidName.execute(Uuid.create(p.data.id), b.data);
      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public changeType = async (req: Request, res: Response) => {
    try {
      const p = FindAsteroidByIdDTO.safeParse(req.params);
      if (!p.success) return invalidBody(res, p.error);
      const b = ChangeAsteroidTypeDTO.safeParse(req.body);
      if (!b.success) return invalidBody(res, b.error);
      const canAccess = await this.canAccessAsteroid(req, p.data.id);
      if (!canAccess) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      await this.changeAsteroidType.execute(Uuid.create(p.data.id), b.data);
      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public changeSize = async (req: Request, res: Response) => {
    try {
      const p = FindAsteroidByIdDTO.safeParse(req.params);
      if (!p.success) return invalidBody(res, p.error);
      const b = ChangeAsteroidSizeDTO.safeParse(req.body);
      if (!b.success) return invalidBody(res, b.error);
      const canAccess = await this.canAccessAsteroid(req, p.data.id);
      if (!canAccess) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      await this.changeAsteroidSize.execute(Uuid.create(p.data.id), b.data);
      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public changeOrbital = async (req: Request, res: Response) => {
    try {
      const p = FindAsteroidByIdDTO.safeParse(req.params);
      if (!p.success) return invalidBody(res, p.error);
      const b = ChangeAsteroidOrbitalDTO.safeParse(req.body);
      if (!b.success) return invalidBody(res, b.error);
      const canAccess = await this.canAccessAsteroid(req, p.data.id);
      if (!canAccess) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      await this.changeAsteroidOrbital.execute(Uuid.create(p.data.id), b.data);
      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };
}
