import { Request, Response } from "express";
import { CreateLog } from "../../app/use-cases/commands/logs/CreateLog.command";
import { ResolveLog } from "../../app/use-cases/commands/logs/ResolveLog.command";
import { FindLog } from "../../app/use-cases/queries/logs/FindLog.query";
import { ListLogs } from "../../app/use-cases/queries/logs/ListLogs.query";
import { CreateLogDTO } from "../security/logs/CreateLog.dto";
import { FindLogByIdDTO } from "../security/logs/FindLogById.dto";
import { ListLogsDTO } from "../security/logs/ListLogs.dto";
import errorHandler from "../../utils/errors/Errors.handler";
import invalidBody from "../../utils/invalidBody";
import { presentLog } from "../presenters/Aggregate.presenter";

export class LogController {
  constructor(
    private readonly createLog: CreateLog,
    private readonly resolveLog: ResolveLog,
    private readonly findLog: FindLog,
    private readonly listLogs: ListLogs,
  ) {}

  public create = async (req: Request, res: Response) => {
    try {
      const parsed = CreateLogDTO.safeParse(req.body);
      if (!parsed.success) return invalidBody(res, parsed.error);
      const created = await this.createLog.execute(parsed.data);
      return res.status(201).json(presentLog(created));
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public resolve = async (req: Request, res: Response) => {
    try {
      const parsed = FindLogByIdDTO.safeParse(req.params);
      if (!parsed.success) return invalidBody(res, parsed.error);
      await this.resolveLog.execute(parsed.data.id, req.auth.userId);
      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public findById = async (req: Request, res: Response) => {
    try {
      const parsed = FindLogByIdDTO.safeParse(req.params);
      if (!parsed.success) return invalidBody(res, parsed.error);
      const log = await this.findLog.byId(parsed.data.id);
      return res.status(200).json(log ? presentLog(log) : null);
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public list = async (req: Request, res: Response) => {
    try {
      const parsed = ListLogsDTO.safeParse(req.query);
      if (!parsed.success) return invalidBody(res, parsed.error);
      const logs = await this.listLogs.execute(parsed.data);
      return res.status(200).json({
        rows: logs.rows.map((row) => presentLog(row)),
        total: logs.total,
      });
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };
}
