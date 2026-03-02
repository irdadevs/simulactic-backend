import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";
import { CreateLog } from "../../app/use-cases/commands/logs/CreateLog.command";
import { SecurityBanService } from "../../app/app-services/security/SecurityBan.service";

type LoggedErrorMeta = {
  code?: string;
  message?: string;
  layer?: string;
  meta?: Record<string, unknown>;
};

export class RequestAuditMiddleware {
  constructor(
    private readonly createLog: CreateLog,
    private readonly securityBan?: SecurityBanService,
  ) {}

  bindRequestId() {
    return (req: Request, res: Response, next: NextFunction) => {
      const requestIdHeader = req.header("x-request-id");
      const requestId = requestIdHeader?.trim() || randomUUID();
      res.locals.requestId = requestId;
      res.locals.requestStartAt = Date.now();
      res.setHeader("x-request-id", requestId);
      next();
    };
  }

  logResponse() {
    return (req: Request, res: Response, next: NextFunction) => {
      res.on("finish", () => {
        const status = res.statusCode;
        const shouldLog =
          status >= 500 ||
          status === 401 ||
          status === 403 ||
          status === 429 ||
          ((req.method === "POST" || req.method === "PATCH" || req.method === "DELETE") &&
            status < 400);

        if (!shouldLog) return;

        const errMeta = (res.locals.errorMeta ?? {}) as LoggedErrorMeta;
        const message =
          errMeta.message ??
          (status >= 500
            ? "Unhandled server failure"
            : `HTTP ${req.method} ${req.path} completed with status ${status}`);
        const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
        const category =
          status >= 500
            ? "infrastructure"
            : status === 401 || status === 403 || status === 429
              ? "security"
              : "audit";

        const durationMs = Math.max(
          0,
          Date.now() - Number(res.locals.requestStartAt ?? Date.now()),
        );
        void this.createLog
          .execute({
            source: "http",
            level,
            category,
            message,
            userId: req.auth?.userId ?? null,
            requestId: res.locals.requestId ?? null,
            method: req.method,
            path: req.path,
            statusCode: status,
            ip: req.ip ?? null,
            userAgent:
              typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
            tags: ["http", req.method.toLowerCase()],
            context: {
              errorCode: errMeta.code,
              layer: errMeta.layer,
              errorMeta: errMeta.meta,
              durationMs,
            },
          })
          .catch(() => {});

        if (this.securityBan) {
          void this.securityBan
            .registerSuspiciousSignal({
              ipAddress: req.ip ?? null,
              statusCode: status,
              method: req.method,
              path: req.path,
            })
            .catch(() => {});
        }
      });

      next();
    };
  }
}
