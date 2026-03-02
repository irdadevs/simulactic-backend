import { Request, Response } from "express";
import { MoonName } from "../../domain/aggregates/Moon";
import { Uuid } from "../../domain/aggregates/User";
import { ChangeMoonName } from "../../app/use-cases/commands/moons/ChangeMoonName.command";
import { ChangeMoonSize } from "../../app/use-cases/commands/moons/ChangeMoonSize.command";
import { ChangeMoonOrbital } from "../../app/use-cases/commands/moons/ChangeMoonOrbital.command";
import { FindMoon } from "../../app/use-cases/queries/moons/FindMoon.query";
import { ListMoonsByPlanet } from "../../app/use-cases/queries/moons/ListMoonsByPlanet.query";
import { FindPlanet } from "../../app/use-cases/queries/planets/FindPlanet.query";
import { FindSystem } from "../../app/use-cases/queries/systems/FindSystem.query";
import { FindGalaxy } from "../../app/use-cases/queries/galaxies/FindGalaxy.query";
import { FindMoonByIdDTO } from "../security/moons/FindMoonById.dto";
import { FindMoonsByPlanetDTO } from "../security/moons/FindMoonsByPlanet.dto";
import { FindMoonByNameDTO } from "../security/moons/FindMoonByName.dto";
import { ChangeMoonNameDTO } from "../security/moons/ChangeMoonName.dto";
import { ChangeMoonSizeDTO } from "../security/moons/ChangeMoonSize.dto";
import { ChangeMoonOrbitalDTO } from "../security/moons/ChangeMoonOrbital.dto";
import errorHandler from "../../utils/errors/Errors.handler";
import invalidBody from "../../utils/invalidBody";
import { presentMoon } from "../presenters/Aggregate.presenter";

export class MoonController {
  constructor(
    private readonly findMoon: FindMoon,
    private readonly listMoonsByPlanet: ListMoonsByPlanet,
    private readonly changeMoonName: ChangeMoonName,
    private readonly changeMoonSize: ChangeMoonSize,
    private readonly changeMoonOrbital: ChangeMoonOrbital,
    private readonly findPlanet: FindPlanet,
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

  private async canAccessPlanet(req: Request, planetId: string): Promise<boolean> {
    if (this.isAdmin(req)) return true;
    const planet = await this.findPlanet.byId(Uuid.create(planetId));
    if (!planet) return false;
    const system = await this.findSystem.byId(Uuid.create(planet.systemId));
    if (!system) return false;
    return this.canAccessGalaxy(req, system.galaxyId);
  }

  private async canAccessMoon(req: Request, moonId: string): Promise<boolean> {
    if (this.isAdmin(req)) return true;
    const moon = await this.findMoon.byId(Uuid.create(moonId));
    if (!moon) return false;
    return this.canAccessPlanet(req, moon.planetId);
  }

  public listByPlanet = async (req: Request, res: Response) => {
    try {
      const parsed = FindMoonsByPlanetDTO.safeParse(req.params);
      if (!parsed.success) return invalidBody(res, parsed.error);
      const canAccess = await this.canAccessPlanet(req, parsed.data.planetId);
      if (!canAccess) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      const result = await this.listMoonsByPlanet.execute(Uuid.create(parsed.data.planetId));
      return res.status(200).json({
        rows: result.rows.map((row) => presentMoon(row)),
        total: result.total,
      });
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public findById = async (req: Request, res: Response) => {
    try {
      const parsed = FindMoonByIdDTO.safeParse(req.params);
      if (!parsed.success) return invalidBody(res, parsed.error);
      const canAccess = await this.canAccessMoon(req, parsed.data.id);
      if (!canAccess) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      const moon = await this.findMoon.byId(Uuid.create(parsed.data.id));
      return res.status(200).json(moon ? presentMoon(moon) : null);
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public findByName = async (req: Request, res: Response) => {
    try {
      const parsed = FindMoonByNameDTO.safeParse(req.params);
      if (!parsed.success) return invalidBody(res, parsed.error);
      const moon = await this.findMoon.byName(MoonName.create(parsed.data.name));
      if (moon) {
        const canAccess = await this.canAccessPlanet(req, moon.planetId);
        if (!canAccess) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }
      return res.status(200).json(moon ? presentMoon(moon) : null);
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public changeName = async (req: Request, res: Response) => {
    try {
      const p = FindMoonByIdDTO.safeParse(req.params);
      if (!p.success) return invalidBody(res, p.error);
      const b = ChangeMoonNameDTO.safeParse(req.body);
      if (!b.success) return invalidBody(res, b.error);
      const canAccess = await this.canAccessMoon(req, p.data.id);
      if (!canAccess) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      await this.changeMoonName.execute(Uuid.create(p.data.id), b.data);
      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public changeSize = async (req: Request, res: Response) => {
    try {
      const p = FindMoonByIdDTO.safeParse(req.params);
      if (!p.success) return invalidBody(res, p.error);
      const b = ChangeMoonSizeDTO.safeParse(req.body);
      if (!b.success) return invalidBody(res, b.error);
      const canAccess = await this.canAccessMoon(req, p.data.id);
      if (!canAccess) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      await this.changeMoonSize.execute(Uuid.create(p.data.id), b.data);
      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public changeOrbital = async (req: Request, res: Response) => {
    try {
      const p = FindMoonByIdDTO.safeParse(req.params);
      if (!p.success) return invalidBody(res, p.error);
      const b = ChangeMoonOrbitalDTO.safeParse(req.body);
      if (!b.success) return invalidBody(res, b.error);
      const canAccess = await this.canAccessMoon(req, p.data.id);
      if (!canAccess) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      await this.changeMoonOrbital.execute(Uuid.create(p.data.id), b.data);
      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };
}
