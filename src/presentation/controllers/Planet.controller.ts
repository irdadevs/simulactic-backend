import { Request, Response } from "express";
import { PlanetName } from "../../domain/aggregates/Planet";
import { Uuid } from "../../domain/aggregates/User";
import { ChangePlanetBiome } from "../../app/use-cases/commands/planets/ChangePlanetBiome.command";
import { ChangePlanetName } from "../../app/use-cases/commands/planets/ChangePlanetName.command";
import { ChangePlanetOrbital } from "../../app/use-cases/commands/planets/ChangePlanetOrbital.command";
import { FindPlanet } from "../../app/use-cases/queries/planets/FindPlanet.query";
import { ListPlanetsBySystem } from "../../app/use-cases/queries/planets/ListPlanetsBySystem.query";
import { FindSystem } from "../../app/use-cases/queries/systems/FindSystem.query";
import { FindGalaxy } from "../../app/use-cases/queries/galaxies/FindGalaxy.query";
import { FindPlanetByIdDTO } from "../security/planets/FindPlanetById.dto";
import { FindPlanetsBySystemDTO } from "../security/planets/FindPlanetsBySystem.dto";
import { FindPlanetByNameDTO } from "../security/planets/FindPlanetByName.dto";
import { ChangePlanetNameDTO } from "../security/planets/ChangePlanetName.dto";
import { ChangePlanetOrbitalDTO } from "../security/planets/ChangePlanetOrbital.dto";
import { ChangePlanetBiomeDTO } from "../security/planets/ChangePlanetBiome.dto";
import errorHandler from "../../utils/errors/Errors.handler";
import invalidBody from "../../utils/invalidBody";
import { presentPlanet } from "../presenters/Aggregate.presenter";

export class PlanetController {
  constructor(
    private readonly findPlanet: FindPlanet,
    private readonly listPlanetsBySystem: ListPlanetsBySystem,
    private readonly changePlanetName: ChangePlanetName,
    private readonly changePlanetOrbital: ChangePlanetOrbital,
    private readonly changePlanetBiome: ChangePlanetBiome,
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

  private async canAccessPlanet(req: Request, planetId: string): Promise<boolean> {
    if (this.isAdmin(req)) return true;
    const planet = await this.findPlanet.byId(Uuid.create(planetId));
    if (!planet) return false;
    return this.canAccessSystem(req, planet.systemId);
  }

  public listBySystem = async (req: Request, res: Response) => {
    try {
      const parsed = FindPlanetsBySystemDTO.safeParse(req.params);
      if (!parsed.success) return invalidBody(res, parsed.error);
      const canAccess = await this.canAccessSystem(req, parsed.data.systemId);
      if (!canAccess) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      const result = await this.listPlanetsBySystem.execute(Uuid.create(parsed.data.systemId));
      return res.status(200).json({
        rows: result.rows.map((row) => presentPlanet(row)),
        total: result.total,
      });
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public findById = async (req: Request, res: Response) => {
    try {
      const parsed = FindPlanetByIdDTO.safeParse(req.params);
      if (!parsed.success) return invalidBody(res, parsed.error);
      const canAccess = await this.canAccessPlanet(req, parsed.data.id);
      if (!canAccess) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      const planet = await this.findPlanet.byId(Uuid.create(parsed.data.id));
      return res.status(200).json(planet ? presentPlanet(planet) : null);
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public findByName = async (req: Request, res: Response) => {
    try {
      const parsed = FindPlanetByNameDTO.safeParse(req.params);
      if (!parsed.success) return invalidBody(res, parsed.error);
      const planet = await this.findPlanet.byName(PlanetName.create(parsed.data.name));
      if (planet) {
        const canAccess = await this.canAccessSystem(req, planet.systemId);
        if (!canAccess) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }
      return res.status(200).json(planet ? presentPlanet(planet) : null);
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public changeName = async (req: Request, res: Response) => {
    try {
      const p = FindPlanetByIdDTO.safeParse(req.params);
      if (!p.success) return invalidBody(res, p.error);
      const b = ChangePlanetNameDTO.safeParse(req.body);
      if (!b.success) return invalidBody(res, b.error);
      const canAccess = await this.canAccessPlanet(req, p.data.id);
      if (!canAccess) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      await this.changePlanetName.execute(Uuid.create(p.data.id), b.data);
      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public changeOrbital = async (req: Request, res: Response) => {
    try {
      const p = FindPlanetByIdDTO.safeParse(req.params);
      if (!p.success) return invalidBody(res, p.error);
      const b = ChangePlanetOrbitalDTO.safeParse(req.body);
      if (!b.success) return invalidBody(res, b.error);
      const canAccess = await this.canAccessPlanet(req, p.data.id);
      if (!canAccess) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      await this.changePlanetOrbital.execute(Uuid.create(p.data.id), b.data);
      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public changeBiome = async (req: Request, res: Response) => {
    try {
      const p = FindPlanetByIdDTO.safeParse(req.params);
      if (!p.success) return invalidBody(res, p.error);
      const b = ChangePlanetBiomeDTO.safeParse(req.body);
      if (!b.success) return invalidBody(res, b.error);
      const canAccess = await this.canAccessPlanet(req, p.data.id);
      if (!canAccess) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      await this.changePlanetBiome.execute(Uuid.create(p.data.id), b.data);
      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };
}
