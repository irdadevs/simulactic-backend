import { Request, Response } from "express";
import { StarName } from "../../domain/aggregates/Star";
import { Uuid } from "../../domain/aggregates/User";
import { ChangeStarMain } from "../../app/use-cases/commands/stars/ChangeStarMain.command";
import { ChangeStarName } from "../../app/use-cases/commands/stars/ChangeStarName.command";
import { ChangeStarOrbital } from "../../app/use-cases/commands/stars/ChangeStarOrbital.command";
import { ChangeStarStarterOrbital } from "../../app/use-cases/commands/stars/ChangeStarStarterOrbital.command";
import { FindStar } from "../../app/use-cases/queries/stars/FindStar.query";
import { ListStarsBySystem } from "../../app/use-cases/queries/stars/ListStarsBySystem.query";
import { FindSystem } from "../../app/use-cases/queries/systems/FindSystem.query";
import { FindGalaxy } from "../../app/use-cases/queries/galaxies/FindGalaxy.query";
import { FindStarByIdDTO } from "../security/stars/FindStarById.dto";
import { FindStarsBySystemDTO } from "../security/stars/FindStarsBySystem.dto";
import { FindStarByNameDTO } from "../security/stars/FindStarByName.dto";
import { ChangeStarNameDTO } from "../security/stars/ChangeStarName.dto";
import { ChangeStarMainDTO } from "../security/stars/ChangeStarMain.dto";
import { ChangeStarOrbitalDTO } from "../security/stars/ChangeStarOrbital.dto";
import { ChangeStarStarterOrbitalDTO } from "../security/stars/ChangeStarStarterOrbital.dto";
import errorHandler from "../../utils/errors/Errors.handler";
import invalidBody from "../../utils/invalidBody";
import { presentStar } from "../presenters/Aggregate.presenter";

export class StarController {
  constructor(
    private readonly findStar: FindStar,
    private readonly listStarsBySystem: ListStarsBySystem,
    private readonly changeStarName: ChangeStarName,
    private readonly changeStarMain: ChangeStarMain,
    private readonly changeStarOrbital: ChangeStarOrbital,
    private readonly changeStarStarterOrbital: ChangeStarStarterOrbital,
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

  private async canAccessStar(req: Request, starId: string): Promise<boolean> {
    if (this.isAdmin(req)) return true;
    const star = await this.findStar.byId(Uuid.create(starId));
    if (!star) return false;
    return this.canAccessSystem(req, star.systemId);
  }

  public listBySystem = async (req: Request, res: Response) => {
    try {
      const parsed = FindStarsBySystemDTO.safeParse(req.params);
      if (!parsed.success) return invalidBody(res, parsed.error);

      const canAccess = await this.canAccessSystem(req, parsed.data.systemId);
      if (!canAccess) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

      const result = await this.listStarsBySystem.execute(Uuid.create(parsed.data.systemId));
      return res.status(200).json({
        rows: result.rows.map((row) => presentStar(row)),
        total: result.total,
      });
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public findById = async (req: Request, res: Response) => {
    try {
      const parsed = FindStarByIdDTO.safeParse(req.params);
      if (!parsed.success) return invalidBody(res, parsed.error);

      const canAccess = await this.canAccessStar(req, parsed.data.id);
      if (!canAccess) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

      const star = await this.findStar.byId(Uuid.create(parsed.data.id));
      return res.status(200).json(star ? presentStar(star) : null);
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public findByName = async (req: Request, res: Response) => {
    try {
      const parsed = FindStarByNameDTO.safeParse(req.params);
      if (!parsed.success) return invalidBody(res, parsed.error);

      const star = await this.findStar.byName(StarName.create(parsed.data.name));
      if (star) {
        const canAccess = await this.canAccessSystem(req, star.systemId);
        if (!canAccess) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }

      return res.status(200).json(star ? presentStar(star) : null);
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public changeName = async (req: Request, res: Response) => {
    try {
      const p = FindStarByIdDTO.safeParse(req.params);
      if (!p.success) return invalidBody(res, p.error);
      const b = ChangeStarNameDTO.safeParse(req.body);
      if (!b.success) return invalidBody(res, b.error);

      const canAccess = await this.canAccessStar(req, p.data.id);
      if (!canAccess) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

      await this.changeStarName.execute(Uuid.create(p.data.id), b.data);
      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public changeMain = async (req: Request, res: Response) => {
    try {
      const p = FindStarByIdDTO.safeParse(req.params);
      if (!p.success) return invalidBody(res, p.error);
      const b = ChangeStarMainDTO.safeParse(req.body);
      if (!b.success) return invalidBody(res, b.error);

      const canAccess = await this.canAccessStar(req, p.data.id);
      if (!canAccess) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

      await this.changeStarMain.execute(Uuid.create(p.data.id), b.data);
      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public changeOrbital = async (req: Request, res: Response) => {
    try {
      const p = FindStarByIdDTO.safeParse(req.params);
      if (!p.success) return invalidBody(res, p.error);
      const b = ChangeStarOrbitalDTO.safeParse(req.body);
      if (!b.success) return invalidBody(res, b.error);

      const canAccess = await this.canAccessStar(req, p.data.id);
      if (!canAccess) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

      await this.changeStarOrbital.execute(Uuid.create(p.data.id), b.data);
      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public changeStarterOrbital = async (req: Request, res: Response) => {
    try {
      const p = FindStarByIdDTO.safeParse(req.params);
      if (!p.success) return invalidBody(res, p.error);
      const b = ChangeStarStarterOrbitalDTO.safeParse(req.body);
      if (!b.success) return invalidBody(res, b.error);

      const canAccess = await this.canAccessStar(req, p.data.id);
      if (!canAccess) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

      await this.changeStarStarterOrbital.execute(Uuid.create(p.data.id), b.data);
      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };
}
